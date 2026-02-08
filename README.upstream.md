# Okta Auto-Next Extensions (Firefox + Safari)

WebExtensions that automatically advance past the Okta username "Next" step on `https://sso.unimelb.edu.au/`.

Features:
- Toolbar icon with popup toggle (Enable/Disable)
- Options page with the same toggle + settings
- Only runs on `sso.unimelb.edu.au`
- Optional username auto-fill (stored in extension local storage)

## Firefox (Packaged .xpi)

Build the `.xpi`:

```bash
./okta-next-extensions/build_all.sh
```

Then install:
- Drag `okta-next-extensions/dist/okta-auto-next-firefox.xpi` into Firefox, or open it with Firefox.

Note: Firefox stable generally requires extensions to be signed by Mozilla for permanent install. Unsigned `.xpi` works in Developer Edition/Nightly, or via temporary install in stable.

## Chrome (Developer Mode)

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `okta-next-extensions/webextension`

## Safari (macOS)

Safari uses WebExtensions but requires an app wrapper created via Apple’s converter.

Prereqs:
- Xcode installed
- Xcode license accepted: `sudo xcodebuild -license accept`
- Xcode selected: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

1. Build the wrapper project:

```bash
./okta-next-extensions/build_all.sh
```

2. Open `okta-next-extensions/dist/safari/Okta Auto-Next/Okta Auto-Next.xcodeproj` in Xcode.
3. Select the **app scheme** `Okta Auto-Next` and `Product -> Run` once.
4. In the app window, click to open Safari extension preferences.
5. Enable the extension in Safari:
   Safari -> Settings -> Extensions -> Okta Auto-Next
6. If you still don’t see the toolbar icon: in the extension’s settings enable "Show in Toolbar" (if present), or Safari -> View -> Customize Toolbar, or use the Extensions (puzzle) menu to pin it.

## Build Zips

```bash
./okta-next-extensions/build_all.sh
```

Outputs:
- `okta-next-extensions/dist/okta-auto-next-chrome.zip`
- `okta-next-extensions/dist/okta-auto-next-chrome.crx` (best effort)
- `okta-next-extensions/dist/okta-auto-next-firefox.zip`
- `okta-next-extensions/dist/okta-auto-next-firefox.xpi`

Safari note:
- If Xcode shows `Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier`, ensure:
  - App target bundle id is the prefix, e.g. `au.unimelb.okta.Okta-Auto-Next`
  - Extension target bundle id starts with it, e.g. `au.unimelb.okta.Okta-Auto-Next.Extension`

## How It Works

On pages under `sso.unimelb.edu.au`, the content script watches for an Okta username field (`input[name="identifier"]` etc).
If configured, it first fills the username field. Then, when the field is non-empty, it dispatches `input`/`change`, blurs the field, and clicks the visible enabled `Next` control (or submits the form).

## Disable Quickly

- Click the toolbar icon, hit "Disable"
- Or open "Options" and toggle "Enabled"
