chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(["enabled", "interested", "notInterested"]);
  await chrome.storage.local.set({
    enabled: current.enabled === true,
    interested: current.interested || [],
    notInterested: current.notInterested || []
  });
  await paintBadge(current.enabled === true);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  await paintBadge(changes.enabled.newValue === true);
});

async function paintBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#e0b000" });
}
