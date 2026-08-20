import { useEffect, useState } from "react";
import { api } from "../api/client";
import { FxRates } from "../api/types";

export const DISPLAY_CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const CURRENCY_SYMBOLS: Record<string, string> = { ZAR: "R", USD: "$", EUR: "€", GBP: "£" };

// GET /minerals/fx-rates is public (no auth) since the marketplace itself is public —
// fetched once per page load and reused for every listing's price conversion, rather than
// one request per card.
export function useFxRates() {
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    api
      .get<FxRates>("/minerals/fx-rates")
      .then((res) => setRates(res.data.rates))
      .catch(() => setRates(null));
  }, []);

  /** Converts an amount from one currency to another via the USD-pivot rates. Returns null if either currency's rate is unknown. */
  function convert(amount: number, from: string, to: string): number | null {
    if (from === to) return amount;
    if (!rates) return null;
    const fromRate = from === "USD" ? 1 : rates[from];
    const toRate = to === "USD" ? 1 : rates[to];
    if (!fromRate || !toRate) return null;
    return (amount / fromRate) * toRate;
  }

  return { rates, convert, loaded: rates !== null };
}

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: amount >= 100 ? 0 : 2 });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}
