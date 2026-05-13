// Aureon Service Worker — PWA + Background Sync + Message Queue
const CACHE_NAME = 'aureon-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Clean old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests; let the browser handle the rest
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('', {
          status: 504,
          statusText: 'Gateway Timeout (offline)',
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })()
  );
});

// Background Sync — process queued messages when connection returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'aureon-message-sync') {
    event.waitUntil(processQueuedMessages());
  }
});

async function processQueuedMessages() {
  const DB_NAME = 'aureon_queue_db';
  const DB_VERSION = 2;
  const STORE = 'queued_messages';

  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const messages = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const pending = messages.filter(m => m.status === 'queued' || m.status === 'retrying');

    for (const msg of pending) {
      try {
        // Notify clients that we're processing
        const allClients = await clients.matchAll();
        allClients.forEach(client => {
          client.postMessage({
            type: 'QUEUE_STATUS',
            messageId: msg.id,
            status: 'sending',
          });
        });

        // The actual send is handled by the client when it receives QUEUE_STATUS
        // This wakes up the client to process the queue
        allClients.forEach(client => {
          client.postMessage({
            type: 'PROCESS_QUEUE',
          });
        });
      } catch (e) {
        console.error('Background sync failed for message:', msg.id, e);
      }
    }
  } catch (e) {
    console.error('Background sync DB error:', e);
  }
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUEUE_UPDATE') {
    // Broadcast to all clients
    clients.matchAll().then(allClients => {
      allClients.forEach(client => {
        if (client.id !== event.source?.id) {
          client.postMessage(event.data);
        }
      });
    });
  }
});
