interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export interface FetchOptions {
  ttlSeconds?: number;
  headers?: Record<string, string>;
  maxRetries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Server-side HTTP helper dengan:
 * 1. Deduplikasi request yang sedang berjalan bersamaan (in-flight coalescing)
 * 2. In-memory TTL cache untuk menghormati rate-limit API
 * 3. Exponential backoff otomatis saat terkena HTTP 429 atau 5xx
 */
export async function fetchWithResilience<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { ttlSeconds = 30, headers = {}, maxRetries = 3 } = options;
  const now = Date.now();

  // 1. Cek cache
  const cached = memoryCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  // 2. Cek in-flight request agar tidak memukul endpoint yang sama dua kali
  const existingInFlight = inFlightRequests.get(url);
  if (existingInFlight) {
    return existingInFlight as Promise<T>;
  }

  const requestPromise = (async () => {
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...headers,
          },
          next: { revalidate: ttlSeconds },
        });

        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          if (attempt < maxRetries) {
            const retryAfterHeader = res.headers.get("retry-after");
            const retryAfterMs = retryAfterHeader
              ? parseInt(retryAfterHeader, 10) * 1000
              : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 400, 8000);
            attempt++;
            await sleep(retryAfterMs);
            continue;
          }
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} on ${url}`);
        }

        const data = (await res.json()) as T;
        memoryCache.set(url, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
        return data;
      } finally {
        inFlightRequests.delete(url);
      }
    }
  })();

  inFlightRequests.set(url, requestPromise);
  return requestPromise;
}
