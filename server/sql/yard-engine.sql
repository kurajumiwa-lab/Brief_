-- Brief / Yard Engine supplemental PostgreSQL schema
--
-- This migration is the production relational target for the implemented JSON
-- adapter. It is intentionally NOT auto-run by the current server: the store
-- adapter, Supabase auth mapping and deployment RLS policies must be selected
-- before applying it. Money remains in the existing ledger_transactions table;
-- this file does not create a second ledger.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE regional_market AS ENUM ('US_METRO', 'KE', 'NG', 'ZA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE service_tier AS ENUM ('WHATSAPP_STATUS', 'FB_POST', 'DEDICATED_CAMPAIGN', 'EVENT_APPEARANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE advertiser_campaign_state AS ENUM (
    'DRAFT', 'SUBMITTED', 'FUNDING_PENDING', 'FUNDED', 'MATCHING', 'ACTIVE',
    'SETTLEMENT_PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE yard_match_state AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'FULFILLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE yard_asset_state AS ENUM ('DRAFT', 'APPROVED', 'ISSUED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE yard_waitlist_state AS ENUM ('WAITING', 'OFFERED', 'RESERVED', 'REGISTERED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Identity stays canonical in Brief's people/person_aliases tables. `person_id`
-- is text here because the JSON adapter's existing IDs are not UUIDs. The
-- Postgres identity adapter can tighten this to a UUID FK in the same migration
-- that migrates people.
CREATE TABLE IF NOT EXISTS creator_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id text NOT NULL UNIQUE,
  full_name varchar(255) NOT NULL,
  preferred_language varchar(32) NOT NULL DEFAULT 'en',
  regions regional_market[] NOT NULL DEFAULT '{}',
  niche_tags text[] NOT NULL DEFAULT '{}',
  external_social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_profile_id uuid NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  service_type service_tier NOT NULL,
  base_price numeric(18,2) NOT NULL CHECK (base_price > 0),
  currency varchar(3) NOT NULL CHECK (currency IN ('USD', 'KES', 'NGN', 'ZAR')),
  regions regional_market[] NOT NULL,
  fulfillment_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability varchar(16) NOT NULL DEFAULT 'open' CHECK (availability IN ('open', 'closed')),
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_profile_id, service_type, version)
);

CREATE TABLE IF NOT EXISTS advertiser_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id text NOT NULL UNIQUE,
  display_name varchar(255) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertiser_campaigns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_profile_id uuid NOT NULL REFERENCES advertiser_profiles(id) ON DELETE RESTRICT,
  brief_campaign_id text,
  brief_object_id text,
  title varchar(255) NOT NULL,
  brief text NOT NULL DEFAULT '',
  total_budget numeric(18,2) NOT NULL CHECK (total_budget > 0),
  currency varchar(3) NOT NULL CHECK (currency IN ('USD', 'KES', 'NGN', 'ZAR')),
  target_regions regional_market[] NOT NULL DEFAULT '{}',
  target_niches text[] NOT NULL DEFAULT '{}',
  required_service service_tier NOT NULL,
  min_interaction_threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_active_allocations integer NOT NULL DEFAULT 3 CHECK (max_active_allocations > 0),
  state advertiser_campaign_state NOT NULL DEFAULT 'DRAFT',
  expiration_bound_at timestamptz,
  funding_ledger_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_campaign_id uuid NOT NULL REFERENCES advertiser_campaigns(id) ON DELETE CASCADE,
  creator_profile_id uuid NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
  rate_card_id uuid NOT NULL REFERENCES rate_cards(id) ON DELETE RESTRICT,
  service_type service_tier NOT NULL,
  quoted_amount numeric(18,2) NOT NULL CHECK (quoted_amount > 0),
  currency varchar(3) NOT NULL CHECK (currency IN ('USD', 'KES', 'NGN', 'ZAR')),
  match_reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  state yard_match_state NOT NULL DEFAULT 'PROPOSED',
  settlement_state varchar(16) NOT NULL DEFAULT 'pending' CHECK (settlement_state IN ('pending', 'blocked', 'processing', 'paid', 'failed')),
  settlement_reason text,
  proof_url text,
  offer_expires_at timestamptz,
  fulfilled_at timestamptz,
  payout_ledger_transaction_id text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (advertiser_campaign_id, creator_profile_id, rate_card_id)
);

CREATE TABLE IF NOT EXISTS queue_reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_match_id uuid NOT NULL REFERENCES campaign_matches(id) ON DELETE CASCADE,
  creator_profile_id uuid NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
  queue_position integer NOT NULL CHECK (queue_position > 0),
  capacity_units integer NOT NULL DEFAULT 1 CHECK (capacity_units > 0),
  state varchar(16) NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'active', 'released', 'expired')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_campaign_id uuid NOT NULL REFERENCES advertiser_campaigns(id) ON DELETE CASCADE,
  creator_profile_id uuid REFERENCES creator_profiles(id) ON DELETE RESTRICT,
  target_platform service_tier NOT NULL CHECK (target_platform IN ('WHATSAPP_STATUS', 'FB_POST')),
  base_redirect_url text NOT NULL,
  unique_tracking_hash varchar(64) NOT NULL UNIQUE,
  media_asset_url text,
  optimized_copy_text text,
  state yard_asset_state NOT NULL DEFAULT 'DRAFT',
  approved_at timestamptz,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_kind varchar(32) NOT NULL CHECK (source_kind IN ('campaign', 'advertiser_campaign')),
  source_id text NOT NULL,
  title varchar(255),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  state varchar(16) NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'live', 'completed', 'cancelled', 'expired')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id)
);

CREATE TABLE IF NOT EXISTS waiting_list_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id text NOT NULL,
  attendee_ref varchar(255) NOT NULL,
  person_id text,
  name varchar(255),
  contact varchar(255),
  queue_position integer NOT NULL CHECK (queue_position > 0),
  state yard_waitlist_state NOT NULL DEFAULT 'WAITING',
  reserved_at timestamptz,
  offer_expires_at timestamptz,
  registration_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, attendee_ref)
);

CREATE TABLE IF NOT EXISTS vendor_capabilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id text NOT NULL UNIQUE,
  services text[] NOT NULL DEFAULT '{}',
  regions regional_market[] NOT NULL DEFAULT '{}',
  escrow_supported boolean NOT NULL DEFAULT false,
  is_verified_license boolean NOT NULL DEFAULT false,
  verified_by text,
  verified_at timestamptz,
  license_reference varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id text NOT NULL,
  author_id text NOT NULL,
  kind varchar(64) NOT NULL DEFAULT 'staff_recommendation',
  note varchar(1000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery attempts are operational records. The actual economic truth remains
-- ledger_transactions and the provider callback reference.
CREATE TABLE IF NOT EXISTS outbound_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_asset_id uuid REFERENCES ad_assets(id) ON DELETE SET NULL,
  channel varchar(32) NOT NULL,
  recipient_ref varchar(255) NOT NULL,
  provider varchar(64),
  provider_reference varchar(255),
  state varchar(16) NOT NULL CHECK (state IN ('queued', 'accepted', 'delivered', 'failed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_region ON creator_profiles USING gin (regions);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_niche ON creator_profiles USING gin (niche_tags);
CREATE INDEX IF NOT EXISTS idx_rate_cards_match ON rate_cards (service_type, currency, status, availability);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_cards_one_current_service
  ON rate_cards (creator_profile_id, service_type) WHERE status <> 'archived';
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_state_expiry ON advertiser_campaigns (state, expiration_bound_at);
CREATE INDEX IF NOT EXISTS idx_matches_creator_state ON campaign_matches (creator_profile_id, state, offer_expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_expiry ON queue_reservations (state, expires_at);
CREATE INDEX IF NOT EXISTS idx_assets_hash ON ad_assets (unique_tracking_hash);
CREATE INDEX IF NOT EXISTS idx_waitlist_campaign_state ON waiting_list_queue (campaign_id, state, queue_position);
CREATE INDEX IF NOT EXISTS idx_calendar_time ON calendar_entries (starts_at, ends_at, state);

-- Production follow-up: enable RLS and bind policies to the verified person
-- mapping used by the selected Supabase auth adapter. No blanket public write
-- policy belongs here.
