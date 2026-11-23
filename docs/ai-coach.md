# AI Coach (BYOK)

Materiel’s AI Coach and COF extraction use **bring-your-own-key** providers already configured under **Settings → AI API**.

## What is stored where

| Data | Location | In encrypted cloud backup? |
| --- | --- | --- |
| API keys | `{userData}/ai-keys/` via Electron `safeStorage` | **No** |
| AI provider/model prefs + capability cache | `{userData}/ai-prefs/` (non-secret) | No (local prefs file) |
| Saved coach analyses | `ai_analysis` table in `materiel.db` | **Yes** (inside DB) |
| AAR / PPEWS / confirmed stages | `aar*` tables in `materiel.db` | **Yes** |
| COF attachment files | `{userData}/aar-attachments/` | **Yes** (sidecar `.aar-attachments.tar` alongside the DB) |

## Providers

Anthropic, OpenAI, xAI, Groq. Keys never return to the renderer after save (masked suffix only). Production refuses plaintext key storage if `safeStorage` is unavailable.

## Flows

1. **Analyze** — builds local PPEWS stats + AAR text excerpts → optional preview → send → JSON validated → row in `ai_analysis`.
2. **COF extract** — JPEG/PNG downscaled with Electron `nativeImage` → vision completion → suggested stages. User must **confirm** before stages are treated as confirmed. HEIC and PDF soft-fail until native support is solid.

Subscription chat products (ChatGPT Plus, Claude Pro, etc.) are not the same as API keys — use a provider API key with billing enabled.
