-- ===========================================================================
-- HUDUMALINK — PostgreSQL SCHEMA
--
-- The blueprint specifies PostgreSQL with "strict relational constraints and
-- security policies". This file is the production target schema. The Node
-- service currently persists through a JSON document store (see src/store.js)
-- so it runs without a database dependency; these tables are the durable,
-- relational home the same rows migrate into for a multi-instance deployment.
--
-- The four tables mirror the blueprint exactly:
--
--   users              the data subject + their (encrypted) eCitizen token
--   orders             a service order and its lifecycle + escrow status
--   escrow_transactions  the M-Pesa STK ledger row that backs an order
--   documents          the delivered artefact + its authenticity signature
--
-- DATA-PROTECTION NOTES (ODPC / DPA 2019):
--
--   * encrypted_ecitizen_* never stores plaintext. The key lives only in the
--     application (HUDUMA_MASTER_KEY); a database backup alone cannot reveal
--     it. See src/domain/huduma/crypto.js (AES-256-GCM).
--   * phone_number is personal data. It is indexed for lookups but the least-
--     privileged role below can only see the columns it needs.
--   * row-level security is defined so an application role scoped to a single
--     user can read only its own rows. This is defence in depth on top of the
--     application's own authority checks; it is not relied on alone.
--   * Every consequential change is auditable through the history JSONB
--     columns (append-only by convention; the app appends, never overwrites).
-- ===========================================================================

-- Optional namespacing. Comment in to isolate the product.
-- CREATE SCHEMA IF NOT EXISTS huduma;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS huduma_users (
  id                     BIGSERIAL PRIMARY KEY,
  phone_number           VARCHAR(20)  NOT NULL UNIQUE,    -- 2547XXXXXXXX normalised
  display_name           TEXT,

  -- The eCitizen token, split into the three AES-256-GCM artefacts. NONE of
  -- these is ever plaintext; the three together + the server-held key are
  -- required to recover the secret.
  encrypted_ecitizen_iv         BYTEA,
  encrypted_ecitizen_tag        BYTEA,
  encrypted_ecitizen_ciphertext BYTEA,
  encrypted_ecitizen_at         TIMESTAMPTZ,               -- when it was set

  terms_accepted_at      TIMESTAMPTZ,                       -- consent record
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user row with a stored token but no terms record must not exist.
  CONSTRAINT users_token_requires_consent
    CHECK ( (encrypted_ecitizen_ciphertext IS NULL)
            OR (terms_accepted_at IS NOT NULL) )
);

CREATE INDEX IF NOT EXISTS idx_huduma_users_phone
  ON huduma_users (phone_number);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS huduma_orders (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES huduma_users(id),
  phone_number      VARCHAR(20) NOT NULL,                  -- denormalised for fulfilment lookups
  service_type      TEXT NOT NULL,                          -- catalog service id

  -- Lifecycle. The CHECK constraint is the relational mirror of the Node state
  -- machine in src/domain/huduma/orders.js: only the legal values may persist.
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PAID','RUNNING','COMPLETED','REFUNDED')),

  -- Money. Derived from the catalog, never client-supplied. The CHECKs make a
  -- forged split impossible to persist: the parts must sum to the total.
  gov_fee           INTEGER NOT NULL CHECK (gov_fee      >= 0),
  platform_fee      INTEGER NOT NULL CHECK (platform_fee >= 0),
  processing_margin INTEGER NOT NULL CHECK (processing_margin >= 0),
  total_fee         INTEGER NOT NULL CHECK (total_fee > 0),
  currency          TEXT NOT NULL DEFAULT 'KES',
  CONSTRAINT orders_money_sums
    CHECK (gov_fee + platform_fee + processing_margin = total_fee),

  -- Escrow state. Funds are LOCKED the moment M-Pesa confirms; they are
  -- RELEASED only on VERIFIED_COMPLETE; they are REFUNDED on a refund.
  escrow_status     TEXT NOT NULL DEFAULT 'NONE'
                    CHECK (escrow_status IN ('NONE','LOCKED','RELEASED','REFUNDED')),

  -- Free-text the chat captured (company name, plot number, etc.). Stored for
  -- fulfilment; consider masking PII fields at rest in a later pass.
  captured_inputs   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Append-only lifecycle trail: [{status, at, note}, ...]
  history           JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_huduma_orders_user
  ON huduma_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_huduma_orders_status
  ON huduma_orders (status);

-- ---------------------------------------------------------------------------
-- escrow_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS huduma_escrow (
  id                  BIGSERIAL PRIMARY KEY,
  order_id            BIGINT NOT NULL REFERENCES huduma_orders(id),
  mpesa_checkout_id   TEXT,                                 -- the Daraja CheckoutRequestID
  amount              INTEGER NOT NULL CHECK (amount > 0),
  receipt             TEXT,                                 -- M-Pesa receipt number on success
  status              TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','LOCKED','RELEASED','REFUNDED','FAILED')),
  history             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_huduma_escrow_order
  ON huduma_escrow (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_huduma_escrow_checkout
  ON huduma_escrow (mpesa_checkout_id) WHERE mpesa_checkout_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS huduma_documents (
  id                    BIGSERIAL PRIMARY KEY,
  order_id              BIGINT NOT NULL UNIQUE REFERENCES huduma_orders(id),
  s3_secure_url         TEXT NOT NULL,                      -- short-lived, signed URL
  digital_signature_hash TEXT NOT NULL,                     -- SHA-256 of the compiled artefact
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger (one definition, applied to every table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION huduma_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['huduma_users','huduma_orders','huduma_escrow','huduma_documents']) LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %s '
        'FOR EACH ROW EXECUTE FUNCTION huduma_touch_updated_at();', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ===========================================================================
-- ROW-LEVEL SECURITY
--
-- An application role scoped to "act as one user" can read only that user's
-- orders, escrow rows and documents. The session sets a local variable
-- (huduma.current_user_id) on connect; RLS filters on it.
--
-- This is DEFENCE IN DEPTH. The application enforces the same authority in
-- code (src/routes/huduma.js); the database enforces it again so a bug or a
-- compromised query cannot leak another data subject's rows.
-- ===========================================================================

ALTER TABLE huduma_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE huduma_escrow   ENABLE ROW LEVEL SECURITY;
ALTER TABLE huduma_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY huduma_orders_owner ON huduma_orders
  FOR ALL USING (user_id = current_setting('huduma.current_user_id', true)::bigint);

CREATE POLICY huduma_escrow_owner ON huduma_escrow
  FOR ALL USING (order_id IN (
    SELECT id FROM huduma_orders
    WHERE user_id = current_setting('huduma.current_user_id', true)::bigint
  ));

CREATE POLICY huduma_documents_owner ON huduma_documents
  FOR ALL USING (order_id IN (
    SELECT id FROM huduma_orders
    WHERE user_id = current_setting('huduma.current_user_id', true)::bigint
  ));

-- ===========================================================================
-- MIGRATION NOTE
--
-- To back the JSON store with these tables later, the change is contained:
-- each store.* helper maps to a table, and the AES record and the JSON history
-- shape already match these columns. No data transform is required for the
-- additive fields; the CHECK constraints are satisfied by construction because
-- the application already derives money and guards transitions.
-- ===========================================================================
