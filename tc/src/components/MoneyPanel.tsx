import React from 'react';
import * as briefApi from '../api/briefApi';
import type { Transaction, Wallet } from '../api/types';

/**
 * MONEY -- the derived wallet and the ledger behind it.
 *
 * This surfaces capability the server already had and the client never showed.
 * It adds no economic semantics of its own, and that is the whole design:
 *
 *   - The balance is NOT stored anywhere. The server folds it out of real
 *     transaction rows (settled -> available, created/pending/confirmed/held
 *     -> pending). This component displays the result and computes nothing.
 *   - There is no client settlement. Nothing here can move a transaction
 *     between states; transitions are server-authoritative.
 *   - A refund is a STATUS, never a negative amount, so no total here is ever
 *     reduced by a negative row.
 *   - Payouts do not exist. The server says so explicitly via
 *     getDisbursements(), and this panel repeats the server's own reason
 *     rather than showing an empty "payouts" list that would imply "none yet".
 *
 * An empty ledger renders as an empty ledger. There is no seeded balance and
 * no placeholder figure anywhere in this file.
 */

const STATUS_TONE: Record<string, string> = {
  settled: 'text-[#111111]',
  confirmed: 'text-[#111111]',
  held: 'text-[#111111]',
  pending: 'text-[#111111]',
  created: 'text-[#111111]/60',
  failed: 'text-[#111111]',
  refunded: 'text-[#111111]'
};

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString()}`;

export function MoneyPanel() {
  const [wallet, setWallet] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: Wallet | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [ledger, setLedger] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: Transaction[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const load = React.useCallback(async () => {
    setWallet((p) => ({ ...p, status: 'loading', error: null }));
    setLedger((p) => ({ ...p, status: 'loading', error: null }));

    const [w, t] = await Promise.all([
      briefApi.getWallet(),
      briefApi.getTransactions(25)
    ]);

    setWallet(
      w.ok
        ? { status: 'ready', data: w.data, error: null }
        : { status: 'error', data: null, error: w.error }
    );
    setLedger(
      t.ok
        ? { status: 'ready', data: t.data.transactions, error: null }
        : { status: 'error', data: null, error: t.error }
    );
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // The server owns this answer. We repeat its reason verbatim.
  const disbursements = briefApi.getDisbursements();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-[#111111]">Money</h2>
        <p className="text-[11px] text-[#111111]/60 leading-snug mt-1">
          Every figure here is derived from real transactions. Brief stores no
          balance and cannot move money.
        </p>
      </div>

      {(wallet.status === 'loading' || wallet.status === 'idle') && (
        <p className="text-xs text-[#111111]/60">Loading...</p>
      )}

      {wallet.status === 'error' && (
        <div className="border border-[#E5E7EB] bg-[#FFFFFF] rounded-2xl p-4">
          <p className="text-[11px] text-[#111111] leading-snug">
            Couldn't load your wallet. {wallet.error}
          </p>
          <button
            onClick={load}
            className="mt-2 text-[10px] font-extrabold text-[#111111] cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {wallet.status === 'ready' && wallet.data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4">
              <p className="text-[10px] text-[#111111]/60">
                Available
              </p>
              <p className="text-2xl font-extrabold text-[#111111] mt-1">
                {money(wallet.data.balance, wallet.data.currency)}
              </p>
              <p className="text-[10px] text-[#111111] mt-1">
                Settled transactions only
              </p>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4">
              <p className="text-[10px] text-[#111111]/60">
                Pending
              </p>
              <p className="text-2xl font-extrabold text-[#111111] mt-1">
                {money(wallet.data.pending, wallet.data.currency)}
              </p>
              <p className="text-[10px] text-[#111111] mt-1">
                Not yet settled
              </p>
            </div>
          </div>

          <p className="text-[10px] text-[#111111]/40">
            Derived from {wallet.data.transactionCount}{' '}
            {wallet.data.transactionCount === 1 ? 'transaction' : 'transactions'}.
          </p>

          {/* Payment provider. "Not connected" is the truth and is stated as
              such -- Brief never implies money can move when it cannot. */}
          {!wallet.data.provider.configured && (
            <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-4">
              <p className="text-[11px] font-extrabold text-[#111111]">
                No payment provider connected
              </p>
              <p className="text-[10px] text-[#111111]/60 mt-1 leading-snug">
                {wallet.data.provider.reason}
              </p>
            </div>
          )}
        </>
      )}

      {/* LEDGER */}
      <div>
        <h3 className="text-[11px] font-extrabold text-[#111111]/40 mb-2">
          Transactions
        </h3>

        {ledger.status === 'error' && (
          <p className="text-[11px] text-[#111111]">
            Couldn't load transactions. {ledger.error}
          </p>
        )}

        {ledger.status === 'ready' && (ledger.data ?? []).length === 0 && (
          <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-8 text-center">
            <p className="text-xs text-[#111111]/60">No transactions yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {(ledger.data ?? []).map((tx) => (
            <div
              key={tx.id}
              className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3 flex items-center gap-3"
            >
              <span
                className={`text-[9px] shrink-0 ${
                  STATUS_TONE[tx.status] ?? 'text-[#111111]/60'
                }`}
              >
                {tx.status}
              </span>
              <p className="text-xs text-[#111111] flex-1 min-w-0 truncate">
                {tx.description || tx.type}
              </p>
              <span className="text-xs font-extrabold text-[#111111] shrink-0">
                {money(tx.amount, tx.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PAYOUTS -- explicitly unavailable, using the server's own reason. */}
      <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-4">
        <p className="text-[11px] font-extrabold text-[#111111]">Payouts</p>
        <p className="text-[10px] text-[#111111]/60 mt-1 leading-snug">
          {disbursements.reason}
        </p>
      </div>
    </section>
  );
}
