# Materiel

Local-first Electron desktop **firearms tracker**: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup.

**Display name:** Materiel  
**Pricing:** Free and unlimited  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Download

Pre-built installers for **macOS** (`.dmg` / `.zip` for Apple Silicon and Intel), **Windows** (NSIS `.exe`), and **Linux** (AppImage) are on the [Releases](https://github.com/davidcantu/materiel/releases) page.

### macOS install (Apple Silicon / Intel)

Builds are **ad-hoc signed** (no Apple Developer ID / notarization). Gatekeeper will warn once; that is expected.

1. Download `Materiel-*-arm64.dmg` (Apple Silicon) or `Materiel-*-x64.dmg` (Intel). A matching `.zip` is also published if you prefer not to use a disk image.
2. Open the DMG (or unzip) and drag **Materiel** to Applications.
3. First open:
   - **macOS 15 Sequoia+:** double-click → if blocked, open **System Settings → Privacy & Security → Open Anyway**, then confirm.
   - **macOS 14 and earlier:** right-click (or Control-click) the app → **Open** → **Open**.
4. If macOS still says the app is **damaged** (stale quarantine from an older download), clear quarantine once in Terminal, then open again:

```bash
xattr -cr /Applications/Materiel.app
```

First launch: enter email (that is the username).

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
- Inventory, Builds, Logs, Ammo, Dashboard modules

## License

MIT — see [LICENSE](./LICENSE).
