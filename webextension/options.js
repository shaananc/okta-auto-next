/* global chrome */

const api = globalThis.browser || chrome;

const elEnabled = document.getElementById("enabled");
const elPollMs = document.getElementById("pollMs");
const elRequire = document.getElementById("requireNonEmpty");
const elAutofill = document.getElementById("autofillUsername");
const elUsernameValue = document.getElementById("usernameValue");
const elOverwrite = document.getElementById("overwriteUsername");

const DEFAULTS = {
  enabled: true,
  pollMs: 150,
  requireNonEmpty: true,
  autofillUsername: false,
  usernameValue: "",
  overwriteUsername: false
};

async function load() {
  const out = await api.storage.local.get(DEFAULTS);
  const s = { ...DEFAULTS, ...out };
  elEnabled.checked = Boolean(s.enabled);
  elPollMs.value = String(Number(s.pollMs) || DEFAULTS.pollMs);
  elRequire.checked = Boolean(s.requireNonEmpty);
  elAutofill.checked = Boolean(s.autofillUsername);
  elUsernameValue.value = String(s.usernameValue || "");
  elOverwrite.checked = Boolean(s.overwriteUsername);
}

async function save() {
  const pollMs = Math.max(50, Number(elPollMs.value || DEFAULTS.pollMs));
  await api.storage.local.set({
    enabled: Boolean(elEnabled.checked),
    pollMs,
    requireNonEmpty: Boolean(elRequire.checked),
    autofillUsername: Boolean(elAutofill.checked),
    usernameValue: String(elUsernameValue.value || ""),
    overwriteUsername: Boolean(elOverwrite.checked)
  });
}

elEnabled.addEventListener("change", () => {
  save().catch(() => undefined);
});
elPollMs.addEventListener("change", () => {
  save().catch(() => undefined);
});
elRequire.addEventListener("change", () => {
  save().catch(() => undefined);
});
elAutofill.addEventListener("change", () => {
  save().catch(() => undefined);
});
elUsernameValue.addEventListener("change", () => {
  save().catch(() => undefined);
});
elOverwrite.addEventListener("change", () => {
  save().catch(() => undefined);
});

load().catch(() => undefined);
