# Groq fallback setup

Set `GROQ_API_KEY` in `.env.local` for local testing and in Vercel's server environment variables for production, then restart / redeploy. Never use a `NEXT_PUBLIC_` prefix. Keep existing `GEMINI_API_KEY` and `CHALLENGE_SERVER_SECRET` unchanged. No paid upgrade or purchasing flow is added.

Gemini remains primary. HTTP 408, 429, 5xx, network failures, timeouts and the local Gemini capacity guard can fall back to Groq `qwen/qwen3.8-27b`. Invalid inputs, credentials, missing models and blocked/unusable results do not trigger fallback. Once image description uses Groq, caption generation also uses Groq. Without a Groq key, existing Gemini behavior remains. With only a Groq key, both stages use Groq.

Every attempt is authorized against the protected reservation and provider-specific ledger. Gemini retains 5 RPM / 20 RPD; Groq uses 30 RPM / 1,000 RPD as request-count guards. These are conservative app guards, not a guarantee of account availability: Groq also enforces TPM / TPD and may return 429 earlier. Each provider is limited to two calls per reservation. A successful preview charges one credit regardless of fallback, and failures refund it.

Each attempt keeps a 40-second maximum and all stages share a 110-second budget inside the existing 120-second route duration. Logs include request ID, stage, provider, actual model, timing and sanitized failure category; never keys, image data, prompts, captions or login details. Signed previews bind actual caption and description models. Existing Gemini previews remain valid if its key is unchanged.

`docs/groq-fallback.sql` is an additive database migration, including a provider-aware call guard, description model provenance and publishing allowlist. Apply once before deploying this code; old Gemini deployments remain compatible. The connected project's migration is applied by this task.

Official API references: https://console.groq.com/docs/vision and https://console.groq.com/docs/model/qwen/qwen3.8-27b.
