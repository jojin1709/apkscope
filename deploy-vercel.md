# Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Set **Root Directory** to `web`.
4. Framework: Next.js.
5. Build command: `npm run build`.
6. Deploy.

No environment variables are required for the demo.

The frontend's `/api/search` route performs best-effort provider discovery. For production, you can set the Worker URL and move resolver traffic to Cloudflare if desired.
