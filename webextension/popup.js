/* global chrome */

const api = globalThis.browser || chrome;

const statusText = document.getElementById("statusText");
const dot = document.getElementById("dot");
const toggleBtn = document.getElementById("toggleBtn");
const optionsBtn = document.getElementById("optionsBtn");
const miniHint = document.getElementById("miniHint");

async function getSettings() {
  const defaults = { enabled: true, autofillUsername: false, usernameValue: "" };
  const out = await api.storage.local.get(defaults);
  return { ...defaults, ...out };
}

function render(enabled) {
  statusText.textContent = enabled ? "Enabled" : "Disabled";
  dot.classList.toggle("on", Boolean(enabled));
  toggleBtn.textContent = enabled ? "Disable" : "Enable";
}

async function toggle() {
  const { enabled } = await getSettings();
  await api.storage.local.set({ enabled: !enabled });
  render(!enabled);
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      // Nudge content scripts to re-run quickly.
      await api.tabs.reload(tab.id);
    }
  } catch {
    // ignore
  }
}

toggleBtn.addEventListener("click", () => {
  toggle().catch(() => undefined);
});

optionsBtn.addEventListener("click", () => {
  api.runtime.openOptionsPage();
});

(async () => {
  const { enabled, autofillUsername, usernameValue } = await getSettings();
  render(enabled);
  if (autofillUsername && String(usernameValue || "").trim()) {
    miniHint.textContent = `Auto-fill username: ${usernameValue}`;
  } else {
    miniHint.textContent = "Auto-fill username: off";
  }
})();
