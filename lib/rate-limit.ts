type Bucket = { attempts: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max = 5, windowMs = 5 * 60_000) {
  const now = Date.now();
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { attempts: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  if (b.attempts >= max) {
    return { allowed: false as const, retryAfterMs: b.resetAt - now };
  }
  return {
    allowed: true as const,
    increment: () => { b!.attempts++; },
  };
}
