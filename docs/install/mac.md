# macOS install

Builds are **ad-hoc signed** (no Apple Developer ID / notarization). Gatekeeper will warn once; that is expected for current releases.

## Steps

1. From [Releases](https://github.com/davidcantu/materiel/releases/latest), download:
   - Apple Silicon: `Materiel-*-arm64.dmg`
   - Intel: `Materiel-*-x64.dmg`
2. Open the DMG and drag **Materiel** to Applications.
3. First open:
   - **macOS 15 Sequoia+:** double-click → if blocked, open **System Settings → Privacy & Security → Open Anyway**, then confirm.
   - **macOS 14 and earlier:** right-click (Control-click) the app → **Open** → **Open**.
4. If macOS still says the app is **damaged** (stale quarantine attribute), clear it once in Terminal, then open again:

```bash
xattr -cr /Applications/Materiel.app
```

## Why the warning?

Unsigned / ad-hoc builds are not notarized. Materiel is distributed from the public GitHub repo; the Gatekeeper path above is the supported install flow until Developer ID signing lands.

## Next

Enter your email on first launch → [User manual](../user-manual.md). Install overview: [Install](../install.md).
