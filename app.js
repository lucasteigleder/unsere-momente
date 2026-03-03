const STORAGE_KEY = "unsere_momente_v1";

const defaults = [
  { title: "Du fehlst mir", text: "Wenn du das liest: Ich denk an dich. ❤️" },
  { title: "Unser Lieblingsding", text: "Wie wir immer über denselben Quatsch lachen." },
  { title: "Nächstes Wiedersehen", text: "Wir schaffen das. Bald sehen wir uns." }
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

const list = document.getElementById("list");
const randomBox = document.getElementById("randomBox");

const btnRandom = document.getElementById("btnRandom");
const btnAdd = document.getElementById("btnAdd");

const addPanel = document.getElementById("addPanel");
const inpTitle = document.getElementById("inpTitle");
const inpText = document.getElementById("inpText");
const btnSave = document.getElementById("btnSave");
const btnCancel = document.getElementById("btnCancel");

function render() {
  list.innerHTML = "";
  memories.forEach((m, idx) => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="title"></div>
      <div class="text"></div>
      <div class="row" style="margin-top:10px;">
        <button class="secondary" data-del="${idx}">Löschen</button>
      </div>
    `;
    li.querySelector(".title").textContent = m.title || "Ohne Titel";
    li.querySelector(".text").textContent = m.text || "";
    list.appendChild(li);
  });

  list.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del"));
      memories.splice(i, 1);
      saveMemories(memories);
      render();
      randomBox.hidden = true;
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
  inpTitle.focus();
});

btnCancel.addEventListener("click", () => {
  addPanel.hidden = true;
});

btnSave.addEventListener("click", () => {
  const title = inpTitle.value.trim();
  const text = inpText.value.trim();
  if (!title && !text) return;

  memories.unshift({ title: title || "Erinnerung", text });
  saveMemories(memories);
  render();

  addPanel.hidden = true;
  randomBox.hidden = true;
});

render();