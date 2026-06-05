const ipMap = new Map();

/**
 * Lazy IP-based rate limiter (no background timers to remain serverless-safe).
 * Allows maxAttempts per windowMs.
 */
export function rateLimit(ip, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  
  // Lazy cleanup if map gets large
  if (ipMap.size > 1000) {
    for (const [key, val] of ipMap.entries()) {
      if (now > val.resetTime) {
        ipMap.delete(key);
      }
    }
  }

  let data = ipMap.get(ip);
  
  if (!data) {
    data = {
      attempts: 0,
      resetTime: now + windowMs
    };
    ipMap.set(ip, data);
  }
  
  if (now > data.resetTime) {
    data.attempts = 0;
    data.resetTime = now + windowMs;
  }
  
  if (data.attempts >= maxAttempts) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, data.resetTime - now)
    };
  }
  
  return {
    allowed: true,
    increment: () => {
      data.attempts++;
    }
  };
}
