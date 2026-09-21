const list = document.querySelector("#list");
const turn = document.querySelector("#turn");
const status = document.querySelector("#status");
let interested = [];
let notInterested = [];
let enabled = false;

function paint() {
  turn.textContent = enabled ? "Turn off" : "Turn on";
  status.textContent = enabled
    ? `${interested.length} interested, ${notInterested.length} not interested.`
    : "Off. Pick categories, then turn on.";
  for (const button of list.querySelectorAll("button")) {
    const id = button.dataset.id;
    const side = button.dataset.side;
    button.classList.toggle("on-in", side === "in" && interested.includes(id));
    button.classList.toggle("on-out", side === "out" && notInterested.includes(id));
  }
}

for (const category of JEV_CATEGORIES) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<span>${category.label}</span><button type="button" data-side="in" data-id="${category.id}">Interested</button><button type="button" data-side="out" data-id="${category.id}">Not interested</button>`;
  list.appendChild(row);
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  const side = button.dataset.side;
  if (side === "in") {
    interested = interested.includes(id) ? interested.filter((item) => item !== id) : interested.concat(id);
    notInterested = notInterested.filter((item) => item !== id);
  } else {
    notInterested = notInterested.includes(id) ? notInterested.filter((item) => item !== id) : notInterested.concat(id);
    interested = interested.filter((item) => item !== id);
  }
  await chrome.storage.local.set({ interested, notInterested });
  paint();
});

turn.addEventListener("click", async () => {
  enabled = !enabled;
  await chrome.storage.local.set({ enabled });
  paint();
});

chrome.storage.local.get(["enabled", "interested", "notInterested"], (stored) => {
  enabled = stored.enabled === true;
  interested = stored.interested || [];
  notInterested = stored.notInterested || [];
  paint();
});
