const DEFAULT_PROFILE = "";

const keyInput = document.querySelector("#key");
const profileInput = document.querySelector("#profile");
const status = document.querySelector("#status");

chrome.storage.local.get(["apiKey", "profile"], (stored) => {
  keyInput.value = stored.apiKey || "";
  profileInput.value = stored.profile || DEFAULT_PROFILE;
});

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: keyInput.value.trim(),
    profile: profileInput.value.trim() || DEFAULT_PROFILE
  });
  status.textContent = "Saved.";
});
