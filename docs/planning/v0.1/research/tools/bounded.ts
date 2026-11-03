export const MAX_BYTES = 20_000;
export const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
export function boundedItems<T>(items: readonly T[], start = 0) {
  const make = (count: number) => {
    const next = start + count;
    const data = { items: items.slice(start, next), nextCursor: next < items.length ? String(next) : null };
    const body = { ok: true, data, omitted: next < items.length ? [`${items.length - next} items omitted; continue with nextCursor.`] : [] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], structuredContent: body, isError: false };
  };
  let lo = 0;
  let hi = items.length - start;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (bytes(make(mid)) < MAX_BYTES) lo = mid;
    else hi = mid - 1;
  }
  if (lo === 0 && start < items.length) {
    const body = { ok: false, error: { code: 'ITEM_TOO_LARGE', message: 'One item exceeds the result budget.', retryable: false, recovery: 'Request a smaller text range or an element subtree.' }, omitted: ['Items omitted; no cursor advanced.'] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(body) }], structuredContent: body, isError: true };
  }
  return make(lo);
}
