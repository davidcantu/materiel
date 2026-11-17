# Materiel

Local-first Electron desktop **firearms tracker**: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup.

**Display name:** Materiel  
**Pricing:** Free and unlimited  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Download

Get the latest build from **[GitHub Releases](https://github.com/davidcantu/materiel/releases/latest)**.

| OS | Download | Notes |
| --- | --- | --- |
| **macOS Apple Silicon** (M1/M2/M3…) | `Materiel-*-arm64.dmg` | Prefer DMG; matching `-arm64-mac.zip` also published |
| **macOS Intel** | `Materiel-*-x64.dmg` | Matching `-mac.zip` also published |
| **Windows** (x64) | `Materiel-*-setup.exe` | NSIS installer |
| **Linux** (x64) | `Materiel-*.AppImage` | Make executable, then run |

First launch on every platform: enter **email** (that is the username).

### macOS install

Builds are **ad-hoc signed** (no Apple Developer ID / notarization). Gatekeeper will warn once; that is expected.

1. Download the arm64 or x64 DMG from [Releases](https://github.com/davidcantu/materiel/releases/latest).
2. Open the DMG and drag **Materiel** to Applications.
3. First open:
   - **macOS 15 Sequoia+:** double-click → if blocked, **System Settings → Privacy & Security → Open Anyway**, then confirm.
   - **macOS 14 and earlier:** right-click (Control-click) the app → **Open** → **Open**.
4. If macOS still says the app is **damaged** (stale quarantine), clear it once, then open again:

```bash
xattr -cr /Applications/Materiel.app
```

### Windows install

Builds are **unsigned** (no Authenticode cert yet). SmartScreen may warn once; that is expected.

1. Download `Materiel-*-setup.exe` from [Releases](https://github.com/davidcantu/materiel/releases/latest).
2. Run the installer. If SmartScreen appears: **More info** → **Run anyway**.
3. Finish the NSIS setup (desktop shortcut is created by default).
4. Launch **Materiel** from the Start menu or desktop.

### Linux install (AppImage)

1. Download `Materiel-*.AppImage` from [Releases](https://github.com/davidcantu/materiel/releases/latest).
2. Make it executable and run:

```bash
chmod +x Materiel-*.AppImage
./Materiel-*.AppImage
```

If your desktop lacks FUSE, extract and run instead: `./Materiel-*.AppImage --appimage-extract-and-run`.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

```bash
npm install
```

## Mac install (from source)

```bash
git clone https://github.com/davidcantu/materiel.git
cd materiel
npm install
npm run build:mac
```

Open the `.dmg` under `dist/` and install. Prefer a [Release](https://github.com/davidcantu/materiel/releases) download when available.

## Development

```bash
npm run dev
```

Runs Electron with Vite HMR. Uses `.env.development` (mock cloud backup, demo seed).

## Build gates

| Script                     | Mode        | Notes                                                                                       |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`              | development | Local app + mock backup provider                                                            |
| `npm run build:test`       | test        | Typecheck, Vite build (`--mode test`), electron-builder (no publish)                        |
| `npm run build:test:linux` | test        | Same as `build:test`, forced Linux AppImage + unpacked `--dir`                              |
| `npm run smoke:linux`      | test        | `build:test:linux` then brief headless launch of `dist/linux-unpacked/materiel`             |
| `npm run build:prod`       | production  | Typecheck, Vite build (`--mode production`), electron-builder for GitHub Releases packaging |

Platform helpers: `npm run build:mac`, `npm run build:win`, `npm run build:linux` (run on the matching OS or CI).

Packaging targets **AppImage** (linux), **`.dmg`** (mac), and **`.exe`** / NSIS (win) via `electron-builder.yml`, published through GitHub Releases when configured. Linux CI cannot produce mac/win installers — see [docs/packaging-smoke.md](./docs/packaging-smoke.md).

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
```

## Database

Encrypted SQLite (`sqlcipher` / AES-256) with forward migrations. Default key is stored via Electron `safeStorage`; see [docs/database.md](./docs/database.md).

Dev can seed demo data with `MAIN_VITE_SEED_DEMO=true` (already set in `.env.development`).

## Backup

Hourly (configurable) + on quit. Uploads the encrypted DB file.

- **Dev:** mock provider writes to `{userData}/mock-cloud/`
- **Test/Prod:** Google Drive or OneDrive via OAuth PKCE — see [docs/backup.md](./docs/backup.md)

Set `MAIN_VITE_GOOGLE_CLIENT_ID` / `MAIN_VITE_ONEDRIVE_CLIENT_ID` in the matching env file or CI secrets (never commit secrets). IPC: `getBackupSettings`, `setBackupSettings`, `runBackupNow`, `listBackupLogs`, `getBackupStatus`, `authenticateBackup`.

## Project layout

```
src/
  main/           # Electron main process
    db/           # Encrypted SQLite + migrations + §7 helpers
    backup/       # Drive / OneDrive / mock + hourly/quit scheduler
    systems/      # Complete-system create / list IPC
  preload/        # Typed contextBridge
  renderer/       # React UI shell
docs/
  database.md     # Key supply, migrations, schema map
  backup.md       # OAuth setup + IPC
```

Env templates: `.env.development`, `.env.test`, `.env.production`, and `.env.example` (no secrets).

## Follow-ups

- Settings UI for backup provider / interval
- Restore-from-cloud UX
- Optional Apple Developer ID / notarization and Windows Authenticode signing (fewer Gatekeeper / SmartScreen prompts)

## License

MIT — see [LICENSE](./LICENSE).
