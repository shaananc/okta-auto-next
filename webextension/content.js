/* global chrome */

const api = globalThis.browser || chrome;

const USERNAME_SELECTORS = [
  "input[name='identifier']",
  "#okta-signin-username",
  "input[autocomplete='username']",
  "input[type='email']"
];

const PASSWORD_SELECTORS = [
  "input[type='password']",
  "input[name='credentials.passcode']",
  "#okta-signin-password",
  "input[autocomplete='current-password']"
];

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function firstVisible(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el;
  }
  return null;
}

function findNextControl() {
  // Known unimelb Okta: <input type="submit" value="Next">
  const submits = Array.from(
    document.querySelectorAll("input[type='submit'], button[type='submit'], button, [role='button']")
  );
  for (const el of submits) {
    const txt = String(el.value || el.innerText || "").trim();
    if (!txt) continue;
    if (!/^next$/i.test(txt) && !/^continue$/i.test(txt) && !/^sign in$/i.test(txt)) {
      continue;
    }
    if (!isVisible(el)) continue;
    const ariaDisabled = el.getAttribute && el.getAttribute("aria-disabled");
    // We intentionally do NOT filter out disabled here. On Safari, the username
    // can be autofilled via Keychain and Okta may not toggle enabled state in a
    // way we can observe. We'll attempt requestSubmit as a fallback.
    return el;
  }
  return null;
}

function looksLikeUsernameStep() {
  const username = firstVisible(USERNAME_SELECTORS);
  if (!username) return false;
  const next = document.querySelector("input[type='submit'][value='Next']");
  return Boolean(next && isVisible(next));
}

function looksLikeFactorPickerPage() {
  // Defensive: on factor selection pages Okta sometimes leaves an identifier input
  // in the DOM. We must not submit anything there.
  const text = document.body ? document.body.innerText || "" : "";
  return (
    /verify\s+it'?s\s+you/i.test(text) ||
    /security\s+method/i.test(text) ||
    /use\s+okta\s+fastpass/i.test(text) ||
    /okta\s+verify/i.test(text)
  );
}

function dispatchInputEvents(input) {
  try {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {
    // ignore
  }
}

function blurInput(input) {
  try {
    input.blur();
  } catch {
    // ignore
  }
}

function requestSubmit(input) {
  const form = input.form || input.closest("form");
  if (!form) return false;
  try {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof form.submit === "function") {
      form.submit();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function tryAdvanceUsernameStep(username) {
  const next = findNextControl();
  if (next) {
    try {
      next.click();
      return true;
    } catch {
      // ignore
    }
  }

  // Strong fallback: submit the form programmatically. We only do this when the
  // DOM looks like the username step to avoid breaking factor picker screens.
  if (looksLikeUsernameStep()) {
    return requestSubmit(username);
  }

  return false;
}

let settings = {
  enabled: true,
  pollMs: 150,
  requireNonEmpty: true,
  autofillUsername: false,
  usernameValue: "",
  overwriteUsername: false
};

let observer = null;
let timer = null;
let lastAttemptAt = 0;
let attemptCount = 0;
let lastSubmittedAt = 0;
let lastSubmittedValue = "";
let pausedUntil = 0;

function resetLoopState() {
  lastAttemptAt = 0;
  attemptCount = 0;
  lastSubmittedAt = 0;
  lastSubmittedValue = "";
  pausedUntil = 0;
}

function stop() {
  if (observer) observer.disconnect();
  observer = null;
  if (timer) clearInterval(timer);
  timer = null;
  resetLoopState();
}

function onTick() {
  if (!settings.enabled) return;
  if (Date.now() < pausedUntil) return;

  // If password input is visible, we are past username step.
  if (firstVisible(PASSWORD_SELECTORS)) {
    stop();
    return;
  }

  // Do not interfere with factor selection / FastPass choice pages.
  if (looksLikeFactorPickerPage()) {
    stop();
    return;
  }

  const username = firstVisible(USERNAME_SELECTORS);
  if (!username) return;

  const value = String(username.value || "");
  const isEmpty = !value.trim();

  // Optional: auto-fill username.
  if (
    settings.autofillUsername &&
    String(settings.usernameValue || "").trim() &&
    (isEmpty || settings.overwriteUsername)
  ) {
    try {
      username.focus();
    } catch {
      // ignore
    }
    try {
      // Prefer the native value setter to mirror real user input better than direct assignment.
      const proto = Object.getPrototypeOf(username);
      const desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && typeof desc.set === "function") {
        desc.set.call(username, String(settings.usernameValue));
      } else {
        // Fallback
        username.value = String(settings.usernameValue);
      }
    } catch {
      // ignore
    }
    dispatchInputEvents(username);
    // Give Okta a moment to validate and enable Next.
    setTimeout(() => onTick(), 80);
    return;
  }

  if (settings.requireNonEmpty && isEmpty) return;

  // Prevent repeated submissions which can cause Okta to error.
  if (
    value.trim() &&
    value === lastSubmittedValue &&
    Date.now() - lastSubmittedAt < 5000
  ) {
    return;
  }

  const now = Date.now();
  if (now - lastAttemptAt < 600) return;
  lastAttemptAt = now;
  attemptCount += 1;

  dispatchInputEvents(username);
  blurInput(username);

  // Try to advance. On Safari, clicking can be flaky when Keychain autofill is involved,
  // so we also try requestSubmit() (but only on the username step).
  const advanced = tryAdvanceUsernameStep(username);
  if (advanced) {
    lastSubmittedAt = Date.now();
    lastSubmittedValue = value;
    pausedUntil = Date.now() + 2500; // let navigation happen before any further action
  }
}

function start() {
  if (timer || observer) return;
  resetLoopState();

  timer = setInterval(onTick, settings.pollMs);
  observer = new MutationObserver(() => {
    // Quick tick on DOM changes for snappier response.
    onTick();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false
  });

  // Also tick on direct typing/paste.
  document.addEventListener(
    "input",
    (e) => {
      const t = e && e.target;
      if (t && t.matches && t.matches(USERNAME_SELECTORS.join(","))) {
        onTick();
      }
    },
    true
  );
}

async function loadSettings() {
  const defaults = {
    enabled: true,
    pollMs: 150,
    requireNonEmpty: true,
    autofillUsername: false,
    usernameValue: "",
    overwriteUsername: false
  };
  const out = await api.storage.local.get(defaults);
  settings = { ...defaults, ...out };
}

api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let changed = false;
  for (const k of [
    "enabled",
    "pollMs",
    "requireNonEmpty",
    "autofillUsername",
    "usernameValue",
    "overwriteUsername"
  ]) {
    if (changes[k]) {
      settings[k] = changes[k].newValue;
      changed = true;
    }
  }
  if (!changed) return;
  if (settings.enabled) start();
  else stop();
});

(async () => {
  await loadSettings();
  if (settings.enabled) start();
})();
