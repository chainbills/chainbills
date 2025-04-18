import { openDB } from 'idb';
import { defineStore } from 'pinia';
import { onMounted } from 'vue';

export const useCacheStore = defineStore('cache', () => {
  let db: any;

  const useDb = async () => {
    if (!('indexedDB' in window)) return null;
    const db = await openDB('chainbills', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache-v2')) {
          db.createObjectStore('cache-v2');
        }
      },
    });
    return db;
  };

  const retrieve = async (key: string) =>
    db ? await db.get('cache-v2', key) : null;

  const save = async (key: string, value: any) => {
    if (db) {
      const tx = db.transaction('cache-v2', 'readwrite');
      await Promise.all([tx.store.put(value, key), tx.done]);
    }
  };

  onMounted(() => {
    useDb().then((result) => (db = result));
  });

  return { retrieve, save };
});
