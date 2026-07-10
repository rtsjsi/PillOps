type CacheEntry<T> = { value: T; at: number };

export function createQueryCache<T>(ttlMs: number) {
  let cached: CacheEntry<T> | null = null;
  let inflight: Promise<T> | null = null;

  return {
    getCached(): T | null {
      if (cached && Date.now() - cached.at < ttlMs) {
        return cached.value;
      }
      return null;
    },
    async fetch(fetcher: () => Promise<T>, options?: { force?: boolean }): Promise<T> {
      if (!options?.force) {
        const hit = this.getCached();
        if (hit !== null) return hit;
        if (inflight) return inflight;
      }

      inflight = fetcher()
        .then((result) => {
          cached = { value: result, at: Date.now() };
          return result;
        })
        .finally(() => {
          inflight = null;
        });

      return inflight;
    },
    clear() {
      cached = null;
      inflight = null;
    },
  };
}
