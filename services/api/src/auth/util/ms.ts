const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Minimal duration-string parser ("15m", "30d", "300s", "1h") -> milliseconds. */
export default function ms(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  const [, amount, unit] = match as unknown as [string, string, keyof typeof UNIT_MS];
  // Safe: the regex only matches one of the keys of UNIT_MS for this group.
  return Number(amount) * (UNIT_MS[unit] as number);
}
