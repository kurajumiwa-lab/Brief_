import { quoteCurrencies } from "../../api/quoteTypes";
export function decimal(n: number | null, c: string) {
  return n === null
    ? ""
    : (n / 10 ** quoteCurrencies[c]).toFixed(quoteCurrencies[c]);
}
export function minor(s: string, c: string) {
  const digits = quoteCurrencies[c];
  if (!new RegExp(`^\\d+${digits ? `(?:\\.\\d{1,${digits}})?` : ""}$`).test(s))
    throw new Error(
      `Enter a non-negative ${c} amount with at most ${digits} decimal places.`,
    );
  const [whole, fraction = ""] = s.split(".");
  const n = Number(
    BigInt(whole) * BigInt(10 ** digits) +
      BigInt(fraction.padEnd(digits, "0") || "0"),
  );
  if (!Number.isSafeInteger(n))
    throw new Error("Amount exceeds the supported range.");
  return n;
}

export const money = (n: number | null, c: string) => {
  if (n === null) return "Not stated";
  const digits = ({ UGX: 0, RWF: 0, JPY: 0 } as Record<string, number>)[c] ?? 2;
  const factor = BigInt(10 ** digits),
    amount = BigInt(n);
  // Formatting must not lose a minor unit at the safe-integer upper bound.
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: c })
    .formatToParts(amount / factor)
    .map((p) =>
      p.type === "fraction"
        ? (amount % factor).toString().padStart(digits, "0")
        : p.value,
    )
    .join("");
};
