import { Mock } from '../types';

const DB_NAME = 'MockApiServerDB';
const DB_VERSION = 1;
const STORE_NAME = 'mocks';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject('Error opening IndexedDB.');
    };
  });
};

export const setMocks = async (mocks: Mock[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
        mocks.forEach(mock => store.put(mock));
    };

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = (event) => {
      console.error('Transaction error on setMocks:', (event.target as IDBTransaction).error);
      reject('Failed to save mocks.');
    };
  });
};

export const getMocks = async (): Promise<Mock[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as Mock[]);
    };

    request.onerror = (event) => {
      console.error('Error getting mocks:', (event.target as IDBRequest).error);
      reject('Failed to retrieve mocks.');
    };
  });
};
