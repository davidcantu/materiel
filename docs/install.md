# Install Materiel

Download the latest build from **[GitHub Releases](https://github.com/davidcantu/materiel/releases/latest)**.

Materiel is **free and unlimited**. Mac and Windows builds are **not** Developer ID / Authenticode signed yet — OS warnings on first open are expected. See the OS pages below.

## Assets

Artifact names use the release version (example: `0.2.10`):

| OS | File pattern | Notes |
| --- | --- | --- |
| **macOS Apple Silicon** | `Materiel-<version>-arm64.dmg` | Prefer DMG; `-arm64-mac.zip` also published |
| **macOS Intel** | `Materiel-<version>-x64.dmg` | Matching `-mac.zip` also published |
| **Windows** (x64) | `Materiel-<version>-setup.exe` | NSIS installer |
| **Linux** (x64) | `Materiel-<version>.AppImage` | Make executable, then run |

Direct link pattern:

```text
https://github.com/davidcantu/materiel/releases/download/v<version>/<artifact>
```

Example: `…/releases/download/v0.2.10/Materiel-0.2.10-arm64.dmg`

## Per OS

- [macOS — Gatekeeper / Open Anyway / “damaged”](./install/mac.md)
- [Windows — SmartScreen](./install/windows.md)
- [Linux — AppImage](./install/linux.md)

## After install

1. Launch Materiel.
2. Enter your **email** (that is your username — no password).
3. Answer the short tracking setup (firearm types, ammo/loads/value).
4. Start with Inventory or Builds.

Full walkthrough: [User manual](./user-manual.md).

## Updates

In-app **Check for updates** (Settings) and the launch prompt only tell you a newer GitHub Release exists. Download the installer for your OS, quit Materiel, install, then relaunch — your encrypted local data stays on the machine.
