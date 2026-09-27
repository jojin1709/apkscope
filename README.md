# APKScope

A no-login, no-upload Android build discovery UI for security researchers. It does **not** host APK files. It links users to external source pages and can be deployed with Vercel (Next.js) and Cloudflare Workers.

## Project layout

- `web/` — Next.js frontend/API, suitable for Vercel.
- `worker/` — optional Cloudflare Worker resolver/API.

## Local frontend

```bash
cd web
npm install
npm run dev
```
Open http://localhost:3000.

## Vercel

Import the repository and set the project root to `web/`. Build command: `npm run build`.

## Cloudflare Worker

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

Cloudflare currently recommends vinext for new Next.js applications running directly on Workers; this project intentionally keeps the frontend Vercel-friendly and provides a separate Worker so you can use Vercel for the UI and Cloudflare for resolver/API functionality. See Cloudflare's current Next.js Workers guidance.

## Important provider behavior

There is no assumed private APKMirror/APKPure API key. Provider discovery is best-effort. If a provider blocks server-side retrieval, APKScope returns/uses the provider's public search or release page instead of pretending a direct APK URL exists.

Download buttons intentionally open the source page rather than storing temporary `?key=` download URLs. This keeps APKScope from hosting or re-distributing third-party APK files and avoids stale resolver URLs.

## No user storage

The application has no authentication, user database, saved searches, profiles, or uploads.

## Security research note

Only test applications and programs where you have authorization. Verify package name, version, signing information, source, and compatibility before installing any APK or bundle.
