const keyInput = document.querySelector("#key");
const interestsInput = document.querySelector("#interests");
const turn = document.querySelector("#turn");
const status = document.querySelector("#status");

function paint(enabled, hasKey) {
  turn.textContent = enabled ? "Turn off" : "Turn on";
  status.textContent = hasKey ? (enabled ? "On. Gold follows your interests. Red is only ads and spam." : "Off. Click Turn on.") : "Save your key, then turn it on.";
}

chrome.storage.local.get(["apiKey", "profile", "enabled"], (stored) => {
  keyInput.value = stored.apiKey || "";
  interestsInput.value = stored.profile || "";
  paint(stored.enabled === true, Boolean(stored.apiKey));
});

document.querySelector("#save").addEventListener("click", async () => {
  const apiKey = keyInput.value.trim();
  const profile = interestsInput.value.trim();
  await chrome.storage.local.set({ apiKey, profile });
  const { enabled } = await chrome.storage.local.get("enabled");
  paint(enabled === true, Boolean(apiKey));
  status.textContent = "Saved on this computer.";
});

turn.addEventListener("click", async () => {
  const typedKey = keyInput.value.trim();
  const profile = interestsInput.value.trim();
  const stored = await chrome.storage.local.get(["enabled", "apiKey"]);
  const apiKey = typedKey || stored.apiKey || "";
  if (!apiKey && stored.enabled !== true) {
    status.textContent = "Save your key first.";
    return;
  }
  const next = stored.enabled !== true;
  await chrome.storage.local.set({ apiKey, profile, enabled: next });
  paint(next, Boolean(apiKey));
});
