// --- DOM references ---
const form = document.getElementById('scoutForm');
const queueEl = document.getElementById('queue');
const statusEl = document.getElementById('netStatus');
const syncMsg = document.getElementById('syncMsg');
const syncBtn = document.getElementById('syncBtn');

// --- IndexedDB setup ---
const DB_NAME = 'frc-scouting';
const STORE_NAME = 'entries';
let db;

/**
 * Open (or create) the IndexedDB database.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(mode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function addEntry(entry) {
  return new Promise((resolve, reject) => {
    const r = store('readwrite').add(entry);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

function getAllEntries() {
  return new Promise((resolve, reject) => {
    const r = store().getAll();
    r.onsuccess = () => {
      const sorted = r.result.sort((a, b) => b.ts - a.ts);
      resolve(sorted);
    };
    r.onerror = () => reject(r.error);
  });
}

function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    const r = store('readwrite').delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

// --- Helpers ---
function uid() {
  return crypto.randomUUID();
}

function isOnline() {
  return navigator.onLine;
}

function updateNetworkStatus() {
  const online = isOnline();
  statusEl.textContent = online ? 'Online' : 'Offline';
  statusEl.className = 'status ' + (online ? 'online' : 'offline');
}

// --- Render queue list ---
async function renderQueue() {
  const items = await getAllEntries();
  if (!items.length) {
    queueEl.innerHTML = '<li>No entries yet.</li>';
    return;
  }

  queueEl.innerHTML = items.map(e => {
    const status = e.synced ? '(synced)' : '(pending)';
    return `<li>#${e.match} Team ${e.team} | Auto ${e.auto} | Teleop ${e.teleop} ${status}</li>`;
  }).join('');
}

// --- Sync logic ---
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxYzqo5Jp6s8QbollySGGRcmRsWsEgIv75UMG3HAVgIKdOuzX9Tyi7Snviozkrm15fq/exec';
async function syncEntries() {
  if (!isOnline()) {
    syncMsg.textContent = 'Still offline.';
    return;
  }

  const items = await getAllEntries();
  let sent = 0;

  for (const e of items) {
  if (e.synced) continue;

  // Build URL-encoded body: key=value&key2=value2...
  const params = new URLSearchParams();
  params.append('match', e.match);
  params.append('team', e.team);
  params.append('auto', e.auto);
  params.append('teleop', e.teleop);
  params.append('notes', e.notes);
  params.append('id', e.id);

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        // IMPORTANT: this must be exactly this string
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (res.ok) {
      await deleteEntry(e.id);
      sent++;
    } else {
      console.log('Sync error status:', res.status);
    }
  } catch (err) {
    console.error('Sync fetch error:', err);
    // Keep entry for later retry
  }
}

  syncMsg.textContent = `Synced ${sent} entr${sent === 1 ? 'y' : 'ies'}.`;
  await renderQueue();
}

// --- Form handler ---
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const matchInput = document.getElementById('match');
  const teamInput = document.getElementById('team');
  const autoInput = document.getElementById('auto');
  const teleopInput = document.getElementById('teleop');
  const notesInput = document.getElementById('notes');

  const entry = {
    id: uid(),
    ts: Date.now(),
    match: +matchInput.value,
    team: +teamInput.value,
    auto: +autoInput.value || 0,
    teleop: +teleopInput.value || 0,
    notes: notesInput.value.trim(),
    synced: false
  };

  await addEntry(entry);

  form.reset();
  autoInput.value = 0;
  teleopInput.value = 0;

  await renderQueue();

  if (isOnline()) {
    await syncEntries();
  }
});

// --- Sync button ---
syncBtn.addEventListener('click', () => {
  syncEntries();
});

// --- Online / offline events ---
window.addEventListener('online', () => {
  updateNetworkStatus();
  syncEntries();
});

window.addEventListener('offline', () => {
  updateNetworkStatus();
});

// --- Service worker registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // ignore errors for now
    });
  });
}

// --- App startup ---
(async () => {
  db = await openDB();
  updateNetworkStatus();
  await renderQueue();

  if (isOnline()) {
    syncEntries();
  }
})();
