import { openDB } from 'idb'

const dbPromise = openDB('offline-audio', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('files')) {
      const store = db.createObjectStore('files', { keyPath: 'trackId' })
      store.createIndex('by-track', 'trackId')
    }
  }
})

export async function putFile(trackId, file) {
  const db = await dbPromise
  const arrayBuf = await file.arrayBuffer()
  await db.put('files', { trackId, name: file.name, mime: file.type, data: arrayBuf })
}

export async function getFile(trackId) {
  const db = await dbPromise
  const rec = await db.get('files', trackId)
  if (!rec) return null
  return new Blob([rec.data], { type: rec.mime || 'audio/mpeg' })
}

export async function listSaved() {
  const db = await dbPromise
  return db.getAll('files')
}
