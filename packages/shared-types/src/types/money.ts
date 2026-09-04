/**
 * All monetary amounts are integer paise (1 INR = 100 paise) — never
 * floating point rupees — to avoid rounding error in pricing, discounts,
 * and tax math. Format for display only at the presentation layer.
 */
export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function formatInr(paise: Paise): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));
}
