# Materiel licensing

Local-first paid unlock. **No server** is required to activate: the app verifies a signed key offline and stores it encrypted on the device.

## Free tier

Without a paid key, the app allows at most **2** complete firearms (`systems` rows).

Creating a third system (custom or factory) returns a clear IPC error:

```ts
{
  ok: false,
  error: {
    code: 'LICENSE_RIFLE_LIMIT',
    message: 'Free tier allows up to 2 complete firearms (you have 2). …',
    license: { /* LicenseStatusInfo */ }
  }
}
```

Channels: `systems:create-custom`, `systems:create-factory`. Status: `license:get-status`.

Restore preflight: `systems:assert-restore-allowed` with the backup’s system count — blocked when a free-tier install would restore more than 2 systems.

## Email identity + email-bound keys

First launch collects a single **email** (no password). That email **is** the username for license pairing and is shown in Settings and the sidebar.

License keys are **email-bound** (`MAT-1.…` HMAC over the normalized email). Activation uses email + key only:

- Set on first-run (“Get started”), **or**
- Entered together on the welcome “Restore license” form / `activateLicense({ email, key })`.

On success the app stores `{ email, key, activatedAt, username }` in `license.dat` where `username` mirrors the verified email, and syncs the profile email (and username mirror).

### Reinstall recovery

1. Enter the **email the key was issued for**.
2. Paste the `MAT-1.…` key.

The app verifies the key offline and restores paid status. The cryptographic key covers email only; the same email is your local identity after restore.

### Email mismatch UX

- Keys are verified against the email you enter (must match the email embedded in the key) → `LICENSE_EMAIL_MISMATCH` when they differ.
- If Settings shows a profile email that differs from the activated license email, a clear warning is shown. Activating with the issued email updates the local profile email to match.

## Paid key (after Venmo)

v1 payment is **manual**: customer Venmos you → you issue a key → you email the key.

### Issue a key (operator)

```bash
# Never commit the production secret. Keep it in a password manager / CI secret store.
export LICENSE_SIGNING_SECRET='your-long-random-secret'

npm run license:issue -- --email customer@example.com
```

Stdout is the key only (safe to pipe). Stderr has a short human note.

The key format is:

```text
MAT-1.<base64url(email)>.<base64url(HMAC-SHA256)>
```

The HMAC covers the canonical string `v1|<normalized-email>` (email trimmed + lowercased). The same secret must be available to the desktop app as `MAIN_VITE_LICENSE_SIGNING_SECRET` or `LICENSE_SIGNING_SECRET` so activation can verify offline.

### Activate (customer)

On first launch (welcome) or in Settings:

1. Enter the **same email** the key was issued for (first-run or restore).
2. Paste the `MAT-1.…` key.
3. Call `license:activate` / `window.api.activateLicense({ email, key })`.

On success the payload `{ email, key, activatedAt, username }` is written to `{userData}/license.dat` via Electron `safeStorage` when available (plaintext fallback only in headless/dev). The `username` field mirrors the email. The `license_state` DB row is updated to `tier=paid`.

## Dev unlock

`.env.development` sets:

```bash
MAIN_VITE_LICENSE_MODE=unlocked
```

When `unlocked` (aliases: `always-allow`, `dev`), create/restore gates always allow. Use this for local UI work without issuing keys.

`.env.test` / `.env.production` use `MAIN_VITE_LICENSE_MODE=enforced`.

## IPC summary

| Channel | Purpose |
| ------- | ------- |
| `license:get-status` | `LicenseStatusInfo` (tier, counts, `canCreateRifle`, mode, activated email, …) |
| `license:activate` | `{ email, key }` → activate result |
| `license:clear` | Remove local key (dev / support) |
| `systems:create-custom` | Gated create |
| `systems:create-factory` | Gated create |
| `systems:assert-restore-allowed` | Preflight restore by system count |
| `systems:count` | Current complete-system count |

Preload wrappers: `getLicenseStatus`, `activateLicense`, `clearLicense`, `createCustomSystem`, `createFactorySystem`, `assertRestoreAllowed`, `countSystems`.

## Env reference

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `LICENSE_SIGNING_SECRET` | Issuer shell / optional app | HMAC secret for issue + verify |
| `MAIN_VITE_LICENSE_SIGNING_SECRET` | Electron env files / CI | Same secret for the packaged app |
| `MAIN_VITE_LICENSE_MODE` | Env files | `unlocked` (dev) or `enforced` |

Do **not** commit production secrets. `.env.example` documents the names only.
