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

Runs Electron with Vite HMR. Uses `.env.development` (mock cloud backup, unlocked license mode).

## Build gates

| Script               | Mode        | Notes                                                                                       |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`        | development | Local app + mock backup provider                                                            |
| `npm run build:test` | test        | Typecheck, Vite build (`--mode test`), electron-builder (no publish)                        |
| `npm run build:prod` | production  | Typecheck, Vite build (`--mode production`), electron-builder for GitHub Releases packaging |

Platform helpers: `npm run build:mac`, `npm run build:win`, `npm run build:linux` (run on the matching OS or CI).

Packaging targets **`.dmg`** (mac) and **`.exe`** / NSIS (win) via `electron-builder.yml`, published through GitHub Releases when configured.

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
    license/      # Free-tier rifle gate (stub)
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
- License key persistence + create-build gate
- Inventory, Builds, Logs, Ammo, Dashboard modules

## License

MIT — see [LICENSE](./LICENSE).
