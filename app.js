// Splash nach kurzem Moment entfernen
window.addEventListener("load", () => {
  const s = document.getElementById("splash");
  if (!s) return;
  setTimeout(() => s.remove(), 600);
});

const STORAGE_KEY = "unsere_momente_v2";
const DB_NAME = "unsere_momente_db";
const DB_STORE = "photos";

// ---------- IndexedDB helpers ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putPhoto(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deletePhoto(id) {
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhotoUrl(id) {
  if (!id) return null;
  const db = await openDb();
  const blob = await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// ---------- Default Inhalte ----------
const defaults = [
  { id: "d1", title: "Du fehlst mir", text: "Wenn du das liest: Ich denk an dich. ❤️", photoId: null },
  { id: "d2", title: "Unser Lieblingsding", text: "Wie wir immer über denselben Quatsch lachen.", photoId: null },
  { id: "d3", title: "Nächstes Wiedersehen", text: "Wir schaffen das. Bald sehen wir uns.", photoId: null }
];

function loadMemories() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaults.slice();
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : defaults.slice();
  } catch {
    return defaults.slice();
  }
}

function saveMemories(memories) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
}

let memories = loadMemories();

// ---------- DOM ----------
const list = document.getElementById("list");
const randomBox = document.getElementById("randomBox");

const btnRandom = document.getElementById("btnRandom");
const btnAdd = document.getElementById("btnAdd");

const addPanel = document.getElementById("addPanel");
const inpTitle = document.getElementById("inpTitle");
const inpText = document.getElementById("inpText");
const inpPhoto = document.getElementById("inpPhoto");
const btnSave = document.getElementById("btnSave");
const btnCancel = document.getElementById("btnCancel");

// Damit wir ObjectURLs wieder freigeben können:
const objectUrls = new Set();

function clearObjectUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
}

async function render() {
  clearObjectUrls();
  list.innerHTML = "";

  for (let idx = 0; idx < memories.length; idx++) {
    const m = memories[idx];

    const li = document.createElement("li");
    li.className = "item";

    li.innerHTML = `
      <div class="title"></div>
      <div class="text"></div>
      <img class="photo" hidden alt="Foto zur Erinnerung" />
      <div class="row actions">
        <button class="secondary" data-del="${idx}">Löschen</button>
      </div>
    `;

    li.querySelector(".title").textContent = m.title || "Ohne Titel";
    li.querySelector(".text").textContent = m.text || "";

    const img = li.querySelector(".photo");
    if (m.photoId) {
      const url = await getPhotoUrl(m.photoId);
      if (url) {
        objectUrls.add(url);
        img.src = url;
        img.hidden = false;
      }
    }

    list.appendChild(li);
  }

  // Delete handlers
  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.getAttribute("data-del"));
      const removed = memories.splice(i, 1)[0];

      // Foto in DB mitlöschen
      if (removed?.photoId) await deletePhoto(removed.photoId);

      saveMemories(memories);
      randomBox.hidden = true;
      await render();
    });
  });
}

btnRandom.addEventListener("click", () => {
  if (memories.length === 0) return;
  const m = memories[Math.floor(Math.random() * memories.length)];
  randomBox.hidden = false;
  randomBox.textContent = `${m.title}\n\n${m.text}`;
});

btnAdd.addEventListener("click", () => {
  addPanel.hidden = false;
  inpTitle.value = "";
  inpText.value = "";
  inpPhoto.value = "";
  inpTitle.focus();
});

btnCancel.addEventListener("click", () => {
  addPanel.hidden = true;
});

btnSave.addEventListener("click", async () => {
  const title = inpTitle.value.trim();
  const text = inpText.value.trim();
  const file = inpPhoto.files && inpPhoto.files[0];

  if (!title && !text && !file) return;

  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  let photoId = null;

  if (file) {
    photoId = `photo_${id}`;
    await putPhoto(photoId, file);
  }

  memories.unshift({
    id,
    title: title || "Erinnerung",
    text,
    photoId
  });

  saveMemories(memories);

  addPanel.hidden = true;
  randomBox.hidden = true;

  await render();
});

render();