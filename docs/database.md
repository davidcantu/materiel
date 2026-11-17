# Materiel database

Encrypted SQLite via [`better-sqlite3-multiple-ciphers`](https://github.com/m4heshd/better-sqlite3-multiple-ciphers), cipher **`sqlcipher`** (AES-256 at rest).

## Location

Default file: `{userData}/materiel.db` (Electron `app.getPath('userData')`).

## Key / passphrase supply

Precedence when opening the DB:

1. **`key` option** — explicit `string` or `Buffer` (tests / advanced).
2. **`passphrase` option** — user-chosen unlock string; hashed with SHA-256 to 32 bytes.
3. **Env** — `MATERIEL_DB_KEY` or `MAIN_VITE_DB_KEY` (hex 64-char or any string → SHA-256).
4. **Electron `safeStorage` (default for the app)** — on first launch a random 32-byte key is generated, encrypted with the OS keychain/DPAPI via `safeStorage.encryptString`, and written beside the DB as `materiel.db.key`. Later opens decrypt that blob automatically when the OS user session allows it.
5. **Dev-file fallback** — if `safeStorage` is unavailable (common on Linux without a keyring) and `MAIN_VITE_APP_ENV=development` (or `MAIN_VITE_ALLOW_DEV_DB_KEY=true`), a plaintext `materiel.db.key.dev` hex file is used. Not for production.

Local-first default is **safeStorage auto-unlock** (no extra password on every launch). A user passphrase unlock UI can call `openDatabase({ passphrase })` later without changing the schema.

Never log raw keys; `keyFingerprint` (12-char SHA-256 prefix) is safe for diagnostics.

## Pre-migrate backup

When an existing schema needs an upgrade (`applied > 0` and below latest), the opener copies the live database (and `materiel.db.key` / `.key.dev` when present) into a timestamped folder **beside** Electron `userData`, e.g. `…/Application Support/Materiel-db-backup-2026-11-17T01-02-03-456Z/`, then runs `migrate`. First-launch empty DBs and up-to-date databases skip the copy. The live files are never deleted on failure. If open/migrate throws, main shows a native error dialog (Quit / How to view logs) and loads an in-window error page instead of leaving a blank hung window.

## Migrations

Forward-only migrations live in `src/main/db/migrations/`. Runner: `migrate(db)` in `src/main/db/migrate.ts`.

| Version | Name                   | Notes                                                                                                                                                        |
| ------: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|       1 | `001_initial`          | profile, parts, systems, system_misc_parts, load_developments, ammo_inventory, shooting_logs, backup_settings, backup_logs, license_state, schema_migrations |
|       2 | `002_drop_part_name`   | Drops `parts.name` — parts are identified by `id`; UI labels use manufacturer/model/caliber                                                                  |
|       3 | `003_profile_username` | Adds `profile.username` (legacy local identity column)                                                                                                       |
|       4 | `004_email_identity`   | Email is identity: promote email-shaped username → email; mirror `username` ← email                                                                          |

Empty DB → apply all pending versions in a transaction. Profile identity is **email** (username column mirrors email for license pairing).

## Schema map (spec §3 → local-first)

| Spec entity               | Table(s)                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| User / profile / settings | `profile` (single local row)                                                |
| Parts (discriminated)     | `parts`                                                                     |
| Complete systems          | `systems` + `system_misc_parts`                                             |
| Shooting logs             | `shooting_logs`                                                             |
| Load development          | `load_developments`                                                         |
| Ammo inventory            | `ammo_inventory`                                                            |
| Backup settings / logs    | `backup_settings`, `backup_logs` (local metadata)                           |
| License                   | `license_state` + `{userData}/license.dat` (see [license.md](./license.md)) |

## Business-rule helpers

- **§7.2** — `addShootingLog` / `updateShootingLog` / `deleteShootingLog` adjust Action/Barrel/Suppressor round counts and ammo quantity atomically.
- **§7.1** — `createFactorySystem` / `synthesizeFactoryParts` / `deleteSystem` synthesize or remove `action-{id}`, `barrel-{id}`, `chassis-{id}` parts.
- **§7.3** — `moveAmmoToPractice` consolidates a lot into `"Practice Ammo"` for the same caliber (merge or create, then delete source).
- **Dashboard** — `getDashboardSummary` computes KPIs, trailing-12-month rounds, recent activity, and top maintenance alerts.

## Demo seed

Dev-only: `openDatabase({ seedDemo: true })` or `MAIN_VITE_SEED_DEMO=true`. Seeds only when parts and systems are empty. No multi-user passwords.

## Backup metadata

`backup_settings` (singleton) and `backup_logs` store policy and history. Helpers: `src/main/db/backup.ts`. Cloud upload behavior: [backup.md](./backup.md). Local-first default interval is **1 hour** (web spec used 24h).

## IPC

- `db:health` → `{ ready, path, cipher, migrationVersion, encrypted }`
- Parts: `parts:list`, `parts:get`, `parts:create`, `parts:update`, `parts:delete`, `parts:set-status`, `parts:reset-maintenance`
- Systems: `systems:list`, `systems:get`, `systems:create-custom`, `systems:create-factory`, `systems:update`, `systems:delete`, `systems:count`, `systems:assert-restore-allowed` (create paths license-gated)
- Profile: `profile:get`, `profile:update` (`trackValue` / `trackAmmo` / identity fields / `profileImageUrl` JPEG data URI)
- Logs: `logs:list`, `logs:get`, `logs:add`, `logs:update`, `logs:delete`
- Ammo: `ammo:list`, `ammo:get`, `ammo:create`, `ammo:update`, `ammo:delete`, `ammo:move-to-practice`
- Loads: `loads:list`, `loads:get`, `loads:create`, `loads:update`, `loads:delete`
- Dashboard: `dashboard:get` → aggregated KPIs, chart series, recent logs, maintenance alerts
- Backup channels: see [backup.md](./backup.md)
- License + gated system create: see [license.md](./license.md)
