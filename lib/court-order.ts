// Court ordering, shared by Court Hub, the Case Vault filter and the
// case-form court picker. Courts are ordered the way advocates enter them:
// by the first numeric token of the court `number` ("Hall 3" → 3, "2" → 2,
// "III" → no number). Courts without a number sort last, and the court name
// (the code, e.g. "ADJH") breaks ties. This mirrors the web Court Hub's
// firstNumber() + comparator (src/app/app/courts/CourtHubClient.tsx) so both
// platforms show the rolls in the same order.

export function firstNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

type OrderableCourt = { name: string; number?: string | null };

// Ascending by court number, un-numbered courts last, name as the tiebreak.
export function compareCourts(a: OrderableCourt, b: OrderableCourt): number {
  const na = firstNumber(a.number);
  const nb = firstNumber(b.number);
  if (na !== null && nb !== null) {
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  }
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return a.name.localeCompare(b.name);
}

export function sortCourts<T extends OrderableCourt>(courts: T[]): T[] {
  return [...courts].sort(compareCourts);
}
