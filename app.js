window.addEventListener("load", () => {
  const s = document.getElementById("splash");
  if (!s) return;
  setTimeout(() => s.remove(), 600);
});

const PAIR_KEY = "unsere_momente_pair_v1";

// Main UI
const list = document.getElementById("list");
const randomBox = document.getElementById("randomBox");
const btnRandom = document.getElementById("btnRandom");
const btnAdd = document.getElementById("btnAdd");

// Add/Edit Panel
const addPanel = document.getElementById("addPanel");
const inpTitle = document.getElementById("inpTitle");
const inpText = document.getElementById("inpText");
const inpPhoto = document.getElementById("inpPhoto");
const btnSave = document.getElementById("btnSave");
const btnCancel = document.getElementById("btnCancel");

// Edit Photos UI (Thumb grid)
const editPhotos = document.getElementById("editPhotos");
const editPhotosGrid = document.getElementById("editPhotosGrid");

// Pair UI
const pairPanel = document.getElementById("pairPanel");
const inpPair = document.getElementById("inpPair");
const btnPairSave = document.getElementById("btnPairSave");
const btnPairClear = document.getElementById("btnPairClear");
const btnPush = document.getElementById("btnPush");

// Lightbox
const lightbox = document.getElementById("lightbox");
const lightboxTrack = document.getElementById("lightboxTrack");
const lightboxDots = document.getElementById("lightboxDots");
const lightboxClose = document.getElementById("lightboxClose");

let pairCode = (localStorage.getItem(PAIR_KEY) || "").trim();
let memories = [];
let channel = null;

// editing: { id, photo_paths: [], keepSet: Set<string> } | null
let editing = null;

function normalizePair(s) {
  return (s || "").trim().toUpperCase();
}

function showPairPanel(force = false) {
  pairPanel.hidden = !force;
  if (force) inpPair.focus();
}

async function refreshFromCloud() {
  if (!pairCode) return;
  memories = await cloudList(pairCode);
  render();
}

function attachRealtime() {
  if (!pairCode) return;
  if (channel) {
    try { channel.unsubscribe(); } catch {}
    channel = null;
  }
  channel = subscribePair(pairCode, async () => {
    await refreshFromCloud();
  });
}

/**
 * Push aktivieren: Permission + Opt-In + Tag setzen
 */
async function enablePush() {
  if (!pairCode) {
    alert("Bitte erst Paar-Code setzen.");
    showPairPanel(true);
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.Notifications.requestPermission();

      if (OneSignal.User?.PushSubscription?.optIn) {
        await OneSignal.User.PushSubscription.optIn();
      } else if (OneSignal.Notifications?.setOptIn) {
        await OneSignal.Notifications.setOptIn(true);
      }

      await OneSignal.User.addTags({ pair_code: pairCode });
      alert("Push ist aktiv ✅");
    } catch (e) {
      console.error("Push enable error:", e);
      alert("Push klappt gerade nicht (Details in Konsole).");
    }
  });
}

function openAddPanelForNew() {
  editing = null;
  btnSave.textContent = "Speichern";
  addPanel.hidden = false;
  inpTitle.value = "";
  inpText.value = "";
  inpPhoto.value = "";
  inpTitle.focus();

  editPhotos.hidden = true;
  editPhotosGrid.innerHTML = "";
}

function openAddPanelForEdit(m) {
  const paths = Array.isArray(m.photo_paths) ? m.photo_paths : [];
  editing = { id: m.id, photo_paths: paths, keepSet: new Set(paths) };

  btnSave.textContent = "Änderungen speichern";
  addPanel.hidden = false;
  inpTitle.value = m.title || "";
  inpText.value = m.text || "";
  inpPhoto.value = ""; // neue Bilder = hinzufügen
  inpTitle.focus();

  renderEditPhotosGrid();
}

function closeAddPanel() {
  addPanel.hidden = true;
  editing = null;
  btnSave.textContent = "Speichern";
  inpPhoto.value = "";

  editPhotos.hidden = true;
  editPhotosGrid.innerHTML = "";
}

/* --------- Dots + Swipe Helpers --------- */

function makeDots(container, count, activeIndex = 0) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const d = document.createElement("div");
    d.className = "galleryDot" + (i === activeIndex ? " active" : "");
    container.appendChild(d);
  }
}

function setActiveDot(container, index) {
  const dots = Array.from(container.querySelectorAll(".galleryDot"));
  dots.forEach((d, i) => d.classList.toggle("active", i === index));
}

function currentIndexFromScroll(trackEl) {
  const w = trackEl.clientWidth || 1;
  return Math.round(trackEl.scrollLeft / w);
}

function scrollToIndex(trackEl, index) {
  const w = trackEl.clientWidth || 1;
  trackEl.scrollTo({ left: index * w, behavior: "smooth" });
}

/* --------- Lightbox --------- */

function openLightbox(urls, startIndex = 0) {
  lightboxTrack.innerHTML = "";
  urls.forEach((url) => {
    const slide = document.createElement("div");
    slide.className = "lightboxSlide";
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto";
    slide.appendChild(img);
    lightboxTrack.appendChild(slide);
  });

  makeDots(lightboxDots, urls.length, startIndex);

  lightbox.hidden = false;
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => scrollToIndex(lightboxTrack, startIndex));

  const onScroll = () => setActiveDot(lightboxDots, currentIndexFromScroll(lightboxTrack));
  lightboxTrack.addEventListener("scroll", onScroll, { passive: true });
  lightbox._onScroll = onScroll;

  // click dots to jump
  lightboxDots.onclick = (e) => {
    const dotEls = Array.from(lightboxDots.querySelectorAll(".galleryDot"));
    const idx = dotEls.indexOf(e.target);
    if (idx >= 0) scrollToIndex(lightboxTrack, idx);
  };
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = "";
  lightboxTrack.innerHTML = "";
  lightboxDots.innerHTML = "";
  if (lightbox._onScroll) {
    lightboxTrack.removeEventListener("scroll", lightbox._onScroll);
    lightbox._onScroll = null;
  }
}

// ✅ IMMER beim Start schließen (auch wenn Cache/State kaputt ist)
(function bootClose() {
  const lb = document.getElementById("lightbox");
  if (lb) lb.hidden = true;
  document.body.style.overflow = "";
})();

lightboxClose.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeLightbox();
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

window.addEventListener("keydown", (e) => {
  if (!lightbox.hidden && e.key === "Escape") closeLightbox();
});

/* --------- Edit Photo Grid (keep/remove old photos) --------- */

function renderEditPhotosGrid() {
  if (!editing) return;

  const paths = Array.isArray(editing.photo_paths) ? editing.photo_paths : [];
  editPhotosGrid.innerHTML = "";

  if (paths.length === 0) {
    editPhotos.hidden = true;
    return;
  }

  editPhotos.hidden = false;

  for (const p of paths) {
    const url = photoPublicUrl(p);
    if (!url) continue;

    const div = document.createElement("div");
    div.className = "editThumb";

    const img = document.createElement("img");
    img.src = url;
    img.alt = "Vorhandenes Foto";

    const badge = document.createElement("div");
    badge.className = "badge";

    const isKept = editing.keepSet.has(p);
    badge.textContent = isKept ? "✓" : "✖";
    if (!isKept) div.classList.add("off");

    div.appendChild(img);
    div.appendChild(badge);

    div.addEventListener("click", () => {
      if (editing.keepSet.has(p)) editing.keepSet.delete(p);
      else editing.keepSet.add(p);
      renderEditPhotosGrid();
    });

    editPhotosGrid.appendChild(div);
  }
}

/* --------- Render list --------- */

function render() {
  list.innerHTML = "";

  memories.forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "item";

    li.innerHTML = `
      <div class="title"></div>
      <div class="text"></div>

      <div class="gallery" hidden>
        <div class="galleryTrack"></div>
      </div>

      <div class="row actions">
        <button class="secondary" data-edit="${idx}">Bearbeiten</button>
        <button class="secondary" data-del="${idx}">Löschen</button>
      </div>
    `;

    li.querySelector(".title").textContent = m.title || "Ohne Titel";
    li.querySelector(".text").textContent = m.text || "";

    // --- Gallery + Dots + Fullscreen ---
    const gallery = li.querySelector(".gallery");
    const track = li.querySelector(".galleryTrack");

    // dots container
    const dots = document.createElement("div");
    dots.className = "galleryDots";
    gallery.appendChild(dots);

    const paths = Array.isArray(m.photo_paths) ? m.photo_paths : [];
    const urls = paths.map(p => photoPublicUrl(p)).filter(Boolean);

    if (urls.length > 0) {
      track.innerHTML = "";

      urls.forEach((url, i) => {
        const slide = document.createElement("div");
        slide.className = "gallerySlide";

        const img = document.createElement("img");
        img.src = url;
        img.alt = "Foto zur Erinnerung";

        img.addEventListener("click", () => openLightbox(urls, i));

        slide.appendChild(img);
        track.appendChild(slide);
      });

      makeDots(dots, urls.length, 0);

      const onScroll = () => setActiveDot(dots, currentIndexFromScroll(track));
      track.addEventListener("scroll", onScroll, { passive: true });

      dots.addEventListener("click", (e) => {
        const dotEls = Array.from(dots.querySelectorAll(".galleryDot"));
        const dotIndex = dotEls.indexOf(e.target);
        if (dotIndex >= 0) scrollToIndex(track, dotIndex);
      });

      gallery.hidden = false;
    } else {
      gallery.hidden = true;
    }

    // IMPORTANT: append li!
    list.appendChild(li);
  });

  // Delete
  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.getAttribute("data-del"));
      const m = memories[i];
      if (!m) return;

      await cloudDelete(pairCode, m.id, m.photo_paths);
      await refreshFromCloud();
      randomBox.hidden = true;
    });
  });

  // Edit
  list.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-edit"));
      const m = memories[i];
      if (!m) return;
      openAddPanelForEdit(m);
    });
  });
}

/* --------- Buttons --------- */

btnRandom.addEventListener("click", () => {
  if (memories.length === 0) return;
  const m = memories[Math.floor(Math.random() * memories.length)];
  randomBox.hidden = false;
  randomBox.textContent = `${m.title}\n\n${m.text}`;
});

btnAdd.addEventListener("click", () => {
  if (!pairCode) {
    showPairPanel(true);
    return;
  }
  openAddPanelForNew();
});

btnCancel.addEventListener("click", () => {
  closeAddPanel();
});

btnSave.addEventListener("click", async () => {
  const title = inpTitle.value.trim();
  const text = inpText.value.trim();
  const files = inpPhoto.files;
  const hasFiles = files && files.length > 0;

  if (!pairCode) {
    showPairPanel(true);
    return;
  }

  // EDIT: Titel/Text + Bilder: behalten/abwählen + neue hinzufügen
  if (editing) {
    const keep = Array.from(editing.keepSet);

    await cloudUpdateWithPhotosMerge(
      pairCode,
      editing.id,
      { title: title || "Erinnerung", text },
      files,
      editing.photo_paths,
      keep
    );

    closeAddPanel();
    randomBox.hidden = true;
    await refreshFromCloud();
    return;
  }

  // NEW
  if (!title && !text && !hasFiles) return;

  await cloudAdd(pairCode, title || "Erinnerung", text, files);
  closeAddPanel();
  randomBox.hidden = true;
  await refreshFromCloud();
});

// Pair buttons
btnPairSave.addEventListener("click", async () => {
  const code = normalizePair(inpPair.value);
  if (!code) return;

  pairCode = code;
  localStorage.setItem(PAIR_KEY, pairCode);

  await refreshFromCloud();
  attachRealtime();
  pairPanel.hidden = true;
});

btnPush?.addEventListener("click", async () => {
  await enablePush();
});

btnPairClear.addEventListener("click", () => {
  localStorage.removeItem(PAIR_KEY);
  pairCode = "";
  memories = [];
  render();
  randomBox.hidden = true;

  if (channel) {
    try { channel.unsubscribe(); } catch {}
    channel = null;
  }

  showPairPanel(true);
});

/* --------- Start --------- */
(async function init() {
  if (!pairCode) {
    showPairPanel(true);
    return;
  }

  await refreshFromCloud();
  attachRealtime();

  // optional: tag setzen ohne prompt
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try { await OneSignal.User.addTags({ pair_code: pairCode }); } catch {}
  });
})();