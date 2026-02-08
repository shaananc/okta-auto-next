/* global chrome */

const api = globalThis.browser || chrome;

const DEFAULTS = {
  enabled: true,
  pollMs: 150,
  requireNonEmpty: true,
  autofillUsername: false,
  usernameValue: "",
  overwriteUsername: false
};

async function getSettings() {
  const out = await api.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...out };
}

async function setBadge(enabled) {
  try {
    await api.browserAction.setBadgeText({ text: enabled ? "ON" : "OFF" });
    await api.browserAction.setBadgeBackgroundColor({
      color: enabled ? "#1f6feb" : "#6e7681"
    });
  } catch {
    // ignore
  }
}

api.runtime.onInstalled.addListener(async () => {
  const current = await api.storage.local.get(null);
  if (Object.keys(current).length === 0) {
    await api.storage.local.set(DEFAULTS);
  }
  const { enabled } = await getSettings();
  await setBadge(enabled);
});

api.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local") return;
  if (changes.enabled) {
    await setBadge(Boolean(changes.enabled.newValue));
  }
});

