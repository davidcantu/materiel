# Materiel licensing

Local-first paid unlock. **No server** is required to activate: the app verifies a signed key offline (Ed25519 public key embedded in the binary) and stores the activated key encrypted on the device.

## Free tier

Without a paid key, the app allows up to **2 firearms per platform**: 2 bolt-action, 2 pistols, and 2 AR-pattern systems. Mixing platforms within those caps stays free (up to 6 total). A paid key is required when creating a **3rd of any one platform**.

Creating a system that would exceed 2 on its platform (custom or factory) returns a clear IPC error:

```ts
{
  ok: false,
  error: {
    code: 'LICENSE_RIFLE_LIMIT',
    message: 'Free tier allows up to 2 Bolt Action firearms (you have 2). …',
    license: { /* LicenseStatusInfo */ }
  }
}
```

Channels: `systems:create-custom`, `systems:create-factory`. Status: `license:get-status` (includes `countsByPlatform`).

Restore preflight: `systems:assert-restore-allowed` with per-platform counts (preferred) or a bare total (treated conservatively as one platform). Blocked when any platform would exceed 2 on a free-tier install.

## Email identity + email-bound keys

First launch collects a single **email** (no password). That email **is** the username for license pairing and is shown in Settings and the sidebar.

License keys are **email-bound** (`MAT-1.…` Ed25519 signature over the normalized email). Activation uses email + key only:

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

### Generate a keypair (once)

```bash
npm run license:keypair
```

1. Copy the printed **SPKI base64** into `src/main/license/public-key.ts` (`MATERIEL_LICENSE_PUBLIC_KEY_SPKI_B64`).
2. Store the **private PEM** in a password manager. Never commit it. Never put it in `MAIN_VITE_*` or the packaged app.
3. Ship / rebuild the app so the embedded public key matches the private key you will use to issue.

### Issue a key (operator)

```bash
# PKCS8 PEM contents (or base64 DER). Never commit this value.
export LICENSE_SIGNING_PRIVATE_KEY="$(cat materiel-license.pem)"

npm run license:issue -- --email customer@example.com
```

Stdout is the key only (safe to pipe). Stderr has a short human note.

The key format is:

```text
MAT-1.<base64url(email)>.<base64url(Ed25519 signature)>
```

The signature covers the canonical string `v1|<normalized-email>` (email trimmed + lowercased). The desktop app verifies with the **embedded public key only** — no signing secret is required (or accepted) in the app env.

### Trust model

| Material | Where | Purpose |
| -------- | ----- | ------- |
| Ed25519 **public** key | Embedded in app (`public-key.ts`) | Offline verify |
| Ed25519 **private** key | Operator machine / password manager only | Issue keys via CLI |

Anyone can read the public key from the binary; they cannot forge keys without the private key.

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
| `license:clear` | Remove local key (dev / support; confirms in a native dialog) |
| `systems:create-custom` | Gated create |
| `systems:create-factory` | Gated create |
| `systems:assert-restore-allowed` | Preflight restore by per-platform counts (or total) |
| `systems:count` | Current complete-system count |

Preload wrappers: `getLicenseStatus`, `activateLicense`, `clearLicense`, `createCustomSystem`, `createFactorySystem`, `assertRestoreAllowed`, `countSystems`.

## Env reference

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `LICENSE_SIGNING_PRIVATE_KEY` | Issuer shell only | PKCS8 PEM or base64 DER Ed25519 private key for `license:issue` |
| `MAIN_VITE_LICENSE_MODE` | Env files | `unlocked` (dev) or `enforced` |

Do **not** set `MAIN_VITE_LICENSE_SIGNING_SECRET` (removed). Do **not** commit private keys. `.env.example` documents names only.
