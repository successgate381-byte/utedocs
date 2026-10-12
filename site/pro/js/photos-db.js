// P5: photos are kept in the browser's own database (IndexedDB) on this device. Nothing is uploaded.
const DB_NAME = 'utedocs-photos';
const STORE = 'photos';

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run one job on the store and give back its answer once it is safely saved. */
async function run(mode, job) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = job(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const listPhotos = () => run('readonly', (store) => store.getAll());
export const savePhoto = (record) => run('readwrite', (store) => store.put(record));
export const deletePhoto = (id) => run('readwrite', (store) => store.delete(id));
export const clearPhotos = () => run('readwrite', (store) => store.clear());
