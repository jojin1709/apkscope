# Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Set **Root Directory** to `web`.
4. Framework: Next.js.
5. Build command: `npm run build`.
6. Deploy.

No environment variables are required — defaults are built in. Optional overrides:

| Variable | Default | Purpose |
|---|---|---|
| `WORKER_URL` | `https://apkscope-resolver.apkscope.workers.dev` | Where download/proxy URLs point |
| `APTOIDE_API_KEY` | built-in public key | Aptoide API key override |

The frontend's `/api/search` route performs best-effort provider discovery on the edge.
Direct downloads stream through the Cloudflare Worker (`worker/`) — deploy it once with
`npm run deploy` in `worker/` and, if you host it elsewhere, set `WORKER_URL` accordingly.
