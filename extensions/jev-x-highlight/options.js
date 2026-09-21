const DEFAULT_PROFILE = "Umby Marketing. Useful posts help a small agency get customers, run a CRM, do local SEO, or operate the business. Ads, spam, politics, engagement bait, and unrelated viral posts are not useful.";

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
