# Materiel

Local-first Electron desktop app for precision rifle shooters: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup.

**Display name:** Materiel  
**Free tier:** 2 complete rifles (license key unlocks more)  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

```bash
npm install
```

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

## License

Free tier: **2** complete rifles. Paid: HMAC `MAT-1-…` key bound to an email (issued manually after Venmo). Activation is offline; key stored via `safeStorage`. See [docs/license.md](./docs/license.md).

```bash
LICENSE_SIGNING_SECRET='…' npm run license:issue -- --email customer@example.com
```

Dev unlock: `MAIN_VITE_LICENSE_MODE=unlocked` (already set in `.env.development`).

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
