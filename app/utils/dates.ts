// month.ts
export type YyyyMm = `${number}-${string}-01`;

function isYyyyMm(s: string): s is YyyyMm {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function normYyyyMm(s?: string): YyyyMm {
  const d =
    s && isYyyyMm(s)
      ? new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, 1))
      : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function addMonths(yyyyMm: YyyyMm, delta: number): YyyyMm {
  const y = Number(yyyyMm.slice(0, 4));
  const m = Number(yyyyMm.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

export function monthRangeUTC(yyyyMm: YyyyMm): { start: Date; end: Date } {
  const y = Number(yyyyMm.slice(0, 4));
  const m = Number(yyyyMm.slice(5, 7));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}
