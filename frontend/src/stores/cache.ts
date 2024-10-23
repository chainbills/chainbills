import { openDB } from 'idb';
import { defineStore } from 'pinia';
import { onMounted } from 'vue';

export const useCacheStore = defineStore('cache', () => {
  let db: any;

  const useDb = async () => {
    if (!('indexedDB' in window)) return null;
    const db = await openDB('chainbills', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      },
    });
    return db;
  };

  const retrieve = async (key: string) =>
    db ? await db.get('cache', key) : null;

  const save = async (key: string, value: any) => {
    if (db) {
      const tx = db.transaction('cache', 'readwrite');
      await Promise.all([tx.store.put(value, key), tx.done]);
    }
  };

  onMounted(() => {
    useDb().then((result) => (db = result));
  });

  return { retrieve, save };
});
