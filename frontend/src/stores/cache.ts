import { openDB } from 'idb';
import { defineStore } from 'pinia';
import { onMounted } from 'vue';

/**
 * Strips values IndexedDB's structured clone can't handle — functions and any
 * object that transitively contains them (e.g. a viem `Chain` with its
 * `formatters` / `serializers` function tables). Primitives, BigInt, Date,
 * Map, Set, RegExp, ArrayBuffer views and plain arrays/objects pass through.
 * Class instances are flattened to plain objects; callers restore prototypes
 * on retrieve, and any viem-derived fields are re-inflated from
 * `chainNamesToChains` there rather than cached.
 */
const sanitizeForClone = (value: any, seen: WeakSet<object> = new WeakSet()): any => {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'function' || type === 'symbol') return undefined;
  if (type !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeForClone(v, seen));
  if (value instanceof Date || value instanceof RegExp) return value;
  if (value instanceof Map) {
    const out = new Map();
    value.forEach((v, k) => out.set(k, sanitizeForClone(v, seen)));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    value.forEach((v) => out.add(sanitizeForClone(v, seen)));
    return out;
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    const s = sanitizeForClone(v, seen);
    if (s !== undefined || v === null) out[k] = s;
  }
  return out;
};

export const useCacheStore = defineStore('cache', () => {
  let db: any;

  const useDb = async () => {
    if (!('indexedDB' in window)) return null;
    const db = await openDB('chainbills', 3, {
      upgrade(db) {
        if (db.objectStoreNames.contains('cache')) db.deleteObjectStore('cache');
        if (db.objectStoreNames.contains('cache-v2')) db.deleteObjectStore('cache-v2');
        if (!db.objectStoreNames.contains('cache-v3')) db.createObjectStore('cache-v3');
      },
    });
    return db;
  };

  const retrieve = async (key: string) => (db ? await db.get('cache-v3', key) : null);

  const save = async (key: string, value: any) => {
    if (db) {
      const tx = db.transaction('cache-v3', 'readwrite');
      await Promise.all([tx.store.put(sanitizeForClone(value), key), tx.done]);
    }
  };

  const remove = async (key: string) => {
    if (db) {
      const tx = db.transaction('cache-v3', 'readwrite');
      await Promise.all([tx.store.delete(key), tx.done]);
    }
  };

  onMounted(() => {
    useDb().then((result) => (db = result));
  });

  return { retrieve, save, remove };
});
