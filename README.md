# Materiel

Local-first Electron desktop **firearms tracker**: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup.

**Display name:** Materiel  
**Free tier:** up to 2 bolt guns, 2 pistols, and 2 ARs (license key unlocks more of any platform)  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Download

Pre-built installers for **macOS** (`.dmg` for Apple Silicon and Intel), **Windows** (NSIS `.exe`), and **Linux** (AppImage) are on the [Releases](https://github.com/davidcantu/materiel/releases) page.

macOS builds are currently **unsigned** (Gatekeeper may warn — right-click → Open the first time). First launch: enter email (that is the username).

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

Runs Electron with Vite HMR. Uses `.env.development` (mock cloud backup, **unlocked** license mode — creates are never blocked).

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

## Issuing a license

From the repo on a machine with the project:

```bash
npm run license:issue -- --email you@example.com
```

Paste the `MAT-1.…` key in the app (Settings / License). Same email as in the app. Note free tier = up to 2 firearms per platform (bolt / pistol / AR) without a key.

Requires `LICENSE_SIGNING_SECRET` in the environment (see [docs/license.md](./docs/license.md)). Dev unlock: `MAIN_VITE_LICENSE_MODE=unlocked` (already set in `.env.development`).

## Project layout

```
src/
  main/           # Electron main process
    db/           # Encrypted SQLite + migrations + §7 helpers
    backup/       # Drive / OneDrive / mock + hourly/quit scheduler
    license/      # Free-tier rifle gate + activate / verify
    systems/      # Gated create IPC
  preload/        # Typed contextBridge
  renderer/       # React UI shell
scripts/
  issue-license.ts
docs/
  database.md     # Key supply, migrations, schema map
  backup.md       # OAuth setup + IPC
  license.md      # Issue keys, activate, free tier, IPC
```

Env templates: `.env.development`, `.env.test`, `.env.production`, and `.env.example` (no secrets).

## Follow-ups

- Settings UI for backup provider / interval / license activate form
- Restore-from-cloud UX (preflight IPC already gated)
- Inventory, Builds, Logs, Ammo, Dashboard modules

## License

MIT — see [LICENSE](./LICENSE).
