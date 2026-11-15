# Materiel cloud backup

Optional encrypted SQLite backup to **Google Drive** or **OneDrive**. The database file is already AES-256 encrypted at rest; backups upload that encrypted blob (preferred over a plaintext export).

## Behavior

| Trigger | When |
| ------- | ---- |
| Scheduler | While the app is open, when `autoBackupEnabled` and `now >= nextBackupTime` (default interval **1 hour**) |
| Quit | Final attempt on `before-quit` (up to ~30s) |
| Manual | IPC `backup:run-now` |

`BackupSettings` and `BackupLog` rows live in the local encrypted DB (software-spec §3.7, single-user). Allowed intervals: `1`, `12`, `24`, `168` hours.

## Providers

| Provider | Env | Dev default |
| -------- | --- | ----------- |
| `mock` | `MAIN_VITE_BACKUP_PROVIDER=mock` | Yes — copies into `{userData}/mock-cloud/` |
| `google-drive` | `MAIN_VITE_BACKUP_PROVIDER=google-drive` | Needs client ID |
| `onedrive` | `MAIN_VITE_BACKUP_PROVIDER=onedrive` | Needs client ID |

`npm run dev` uses the **mock** provider (see `.env.development`). No OAuth, no network.

When a real provider’s client ID is missing, `isConfigured()` is false and authenticate/upload throw a clear error pointing here. Mock continues to work.

## OAuth setup (test / prod)

Desktop flow: **authorization code + PKCE** with a loopback redirect (`http://127.0.0.1:<ephemeral>/oauth2/callback`). Refresh tokens are stored under `{userData}/backup-oauth/` via Electron `safeStorage` when available.

### Google Drive

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Configure OAuth consent screen (External or Internal).
4. Create OAuth client ID type **Desktop app**.
5. Copy the client ID (and secret if the console still issues one for desktop).
6. Set locally (never commit secrets):

```bash
MAIN_VITE_BACKUP_PROVIDER=google-drive
MAIN_VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# Optional for older desktop clients:
# MAIN_VITE_GOOGLE_CLIENT_SECRET=
```

7. Scope used: `https://www.googleapis.com/auth/drive.file`  
   Files land in a Drive folder named **Materiel Backups**.

### OneDrive (Microsoft Graph)

1. Register an app in [Microsoft Entra ID](https://entra.microsoft.com/) → App registrations → **New registration**.
2. Account type: personal + work/school as needed.
3. Authentication → **Mobile and desktop applications** → add redirect  
   `http://127.0.0.1` (loopback; the app binds an ephemeral port and uses `/oauth2/callback`).  
   For Entra, also allow `http://localhost` if required by your tenant policy.
4. API permissions: `Files.ReadWrite`, `User.Read`, and offline access (delegated).
5. Copy the **Application (client) ID**.

```bash
MAIN_VITE_BACKUP_PROVIDER=onedrive
MAIN_VITE_ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Optional if you use a confidential client (not typical for public desktop):
# MAIN_VITE_ONEDRIVE_CLIENT_SECRET=
```

Files land under OneDrive folder **Materiel Backups**.

### Build gates

| Gate | Suggested provider |
| ---- | ------------------ |
| `npm run dev` | `mock` |
| `npm run build:test` | test OAuth apps / client IDs in CI secrets or local `.env.test` |
| `npm run build:prod` | production OAuth clients; `.env.production` sets `google-drive` by default |

Put client IDs in the env file for that mode or inject via CI. **Do not commit client secrets.**

## IPC (preload `window.api`)

| Channel / method | Purpose |
| ---------------- | ------- |
| `getBackupSettings` / `setBackupSettings` | Read/update policy |
| `runBackupNow` | Manual backup |
| `listBackupLogs` | Recent `BackupLog` rows |
| `getBackupStatus` | Provider + auth + settings |
| `authenticateBackup` / `disconnectBackup` | OAuth connect / clear tokens |

No full Settings UI in this PR — shell still shows the active provider name.

## Restore

`downloadLatestBackup(destPath)` is implemented on each provider for a later restore flow. It is not yet wired to a full replace-DB UX.
