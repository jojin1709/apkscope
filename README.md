<div align="center">

# APKScope

### No-login, no-upload Android build discovery — built for security research

**A real Next.js application** — searches run server-side on the edge across five public
sources (APKMirror, Google Play, Aptoide, APKCombo, TapTap), results are parsed from the
same public pages a browser opens, and every download **streams live through a Cloudflare
Worker proxy straight from the original host** — APKScope **never hosts, stores or
re-distributes a single APK file**.

**Built for** security researchers · pentesters · bug bounty hunters who want package names,
versions, checksums, signing details and direct downloads — **without an account, an upload
or an API key**.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-15-0D1117?style=flat-square&labelColor=0D1117&logo=nextdotjs&logoColor=7B61FF)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-0D1117?style=flat-square&labelColor=0D1117&logo=react&logoColor=7B61FF)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-0D1117?style=flat-square&labelColor=0D1117&logo=typescript&logoColor=7B61FF)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-0D1117?style=flat-square&labelColor=0D1117&logo=cloudflare&logoColor=7B61FF)](https://workers.cloudflare.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-0D1117?style=flat-square&labelColor=0D1117&logo=vercel&logoColor=7B61FF)](https://vercel.com/new)

<br/>

![](https://img.shields.io/badge/No_Login-7B61FF?style=for-the-badge&labelColor=0D1117)
&nbsp;![](https://img.shields.io/badge/No_Uploads-7B61FF?style=for-the-badge&labelColor=0D1117)
&nbsp;![](https://img.shields.io/badge/No_API_Keys-7B61FF?style=for-the-badge&labelColor=0D1117)
&nbsp;![](https://img.shields.io/badge/5_Sources_Search-7B61FF?style=for-the-badge&labelColor=0D1117&logoColor=white)
&nbsp;![](https://img.shields.io/badge/Edge_Runtime-7B61FF?style=for-the-badge&labelColor=0D1117&logoColor=white)
&nbsp;![](https://img.shields.io/badge/No_Cloud_No_Account-7B61FF?style=for-the-badge&labelColor=0D1117)

<br/>

<a href="#quick-start"><img src="https://img.shields.io/badge/🚀_Run_Locally-7B61FF?style=for-the-badge&logo=rocket&logoColor=white" alt="Run locally"></a>&nbsp;
<a href="#deploy-to-vercel"><img src="https://img.shields.io/badge/▲_Deploy_on_Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Deploy on Vercel"></a>&nbsp;
<a href="#cloudflare-worker"><img src="https://img.shields.io/badge/Cloudflare_Worker-30363D?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Worker"></a>&nbsp;
<a href="#honest-scope"><img src="https://img.shields.io/badge/Honest_Scope-30363D?style=for-the-badge&logoColor=white" alt="Honest scope"></a>

</div>

---

## Contents

- [Why APKScope](#why-apkscope)
- [How discovery works](#how-discovery-works)
- [The UI](#the-ui)
- [Quick start](#quick-start)
- [Deploy to Vercel](#deploy-to-vercel)
- [Cloudflare Worker](#cloudflare-worker)
- [Honest scope](#honest-scope)
- [Security research note](#security-research-note)
- [Contributing](#contributing)
- [Support](#support)

---

## Why APKScope

- **🔎 Real results, no fake data** — the search API fetches the public APKMirror, Google
  Play, Aptoide, APKCombo and TapTap search endpoints server-side, then parses real rows:
  app name, **package name**, **version**, developer, rating and icon. When a provider
  blocks the request, it falls back to the provider's own search URL instead of inventing
  entries.
- **📦 Package names first** — Play and TapTap results give you the exact `com.vendor.app`
  identifier; APKMirror contributes releases, versions and developers; Aptoide contributes
  **direct download URLs, sizes, MD5 checksums and signer details**.
- **⬇️ Direct downloads, zero hosting** — download buttons stream the APK **live through
  the Cloudflare Worker from the original host** (allowlisted hosts, `.apk` targets only),
  with a progress bar, file name and size. APKScope stores no APK bytes — there is nothing
  stale or tampered for it to serve.
- **📄 Shareable app pages** — every app gets an SEO page at `/app/<package.name>` with
  OpenGraph metadata, screenshots, description, changelog, versions and VirusTotal links.
- **🚪 Nothing to log into** — no accounts, no database, no uploads, no cookies. Theme,
  language and recently-viewed chips live only in your browser's `localStorage`.
- **⚡ Small surface, no dependencies** — one app page plus a handful of edge routes
  (`/api/search`, `/api/versions`, `/api/resolve`, `/api/app`, `/api/suggest`,
  `/api/browse`); no third-party search API, no provider API keys, no queue, no database.
- **🔒 Abuse-aware** — the search API rate-limits **15 requests/minute per IP** and caches
  results for 10 minutes server-side (30 minutes in the browser tab).
- **🤝 Honesty over hype** — provider scraping is best-effort: if APKMirror rate-limits
  (429) or Cloudflare challenges the request, the UI says so and points at the source page
  rather than pretending a direct APK URL exists.

---

## How discovery works

```
browser ──► /api/search?q=…            (edge route · 10-min cache · 15 req/min/IP)
                 │
                 ├──► APKMirror    public search HTML ── parse rows, versions, icons
                 ├──► Google Play  public search HTML ── parse packages, icons, links
                 ├──► Aptoide      public search JSON ── downloads, sizes, md5, signer
                 ├──► APKCombo     public search HTML ── 5th source (incl. APK-only apps)
                 ├──► TapTap       public search JSON ── identifier-first results
                 │
                 └──► merged JSON, deduped by package name
                               │
           /api/resolve ──► Aptoide exact pkg → Aptoide by name → F-Droid → APKCombo
                               │
        worker /download?url=  └── streams the APK live from the original host
                                    (allowlisted hosts · .apk targets only · nothing stored)
```

- **No keys.** Sources are read the same way a browser would open them — public search
  pages and JSON endpoints, no API key required (an Aptoide key can be overridden via env,
  a default is built in).
- **Best effort by design.** A blocked or rate-limited fetch degrades to a working provider
  link, never to fabricated results.
- **Versions** come from Aptoide's version history, F-Droid's package API and APKCombo's
  version list — merged, deduped and sorted newest-first with size, MD5, date and source
  per row; APKCombo rows stream through the worker when a direct file exists, otherwise
  they link out to the release page.
- **The Worker powers downloads.** Search works without it; direct downloads stream through
  `worker/` (see below).

---

## The UI

| Area | What it does |
|:---:|---|
| 🔍 **Hero search** | Enter-to-search, popular query chips, **live suggestions** (debounced, from Aptoide) |
| 🗂 **Sources panel** | Source / platform / sort filters over the current result list, with per-source counts |
| 📋 **Results list** | Real icon, name, package, version and source badges — **paginated 8 at a time** with *Load more*; click to select |
| 🗂 **Categories & trending** | Category chips and a *Trending now* rail browse APKCombo's top charts into app pages |
| 🕘 **Recently viewed** | Local chips for the last apps you opened — `localStorage` only |
| 🧾 **Detail panel** | **Direct download with live progress bar + cancel**, **QR code** for phones, screenshots, description, changelog (What's New), signer, **MD5 → VirusTotal** links, and a full version table with per-version downloads |
| 📄 **App pages** | Shareable `/app/<package.name>` pages — SSR, OpenGraph/Twitter metadata, canonical URL |
| 🌙 **Dark mode & language** | System-aware dark theme (plus `?theme=dark`), EN / हिं toggle — both remembered in `localStorage` |
| 📲 **PWA** | Web manifest, generated icons, service-worker offline shell — installable on phones |
| ⚠️ **Honest notice** | Every page states that sources are external and APKScope hosts nothing |

---

## Quick start

Requires **Node.js 18.18+** (20+ recommended).

```bash
# 1 — clone
git clone https://github.com/jojin1709/apkscope.git
cd apkscope

# 2 — install and run the web app
cd web
npm install
npm run dev
```

Open **http://localhost:3000** and search for an app.

```bash
# production build check
npm run build

# regenerate the PWA icons (optional)
npm run icons

# optional — the Cloudflare Worker that powers direct downloads
cd ../worker
npm install
npx wrangler login
npm run dev      # local worker
npm run deploy   # deploy to workers.dev
```

---

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import it in Vercel.
3. Set **Root Directory** to `web`.
4. Framework preset: **Next.js** — build command `npm run build`.
5. Deploy.

No environment variables are **required** — sensible defaults are built in. Optional
overrides:

| Variable | Default | Purpose |
|---|---|---|
| `WORKER_URL` | `https://apkscope-resolver.apkscope.workers.dev` | Where download/proxy URLs point |
| `APTOIDE_API_KEY` | built-in public key | Aptoide API key override |

Full steps: [deploy-vercel.md](deploy-vercel.md).

---

## Cloudflare Worker

The worker is optional for browsing — search works without it — but **direct downloads
stream through it**.

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

| Endpoint | What it returns |
|---|---|
| `/health` | `{ ok: true, service: "apkscope-resolver" }` |
| `/proxy?url=…` | CORS proxy for provider HTML (allowlisted hosts only) |
| `/download?url=…` | Streams an `.apk` from the original host as an attachment — **only** allowlisted hosts, **only** `.apk` targets; sets `content-disposition` file names and exposes length headers for the progress bar |
| `/api/search?q=…` | Provider search links (APKMirror, Google Play, Aptoide, APKCombo, TapTap) without API keys |
| `/api/resolve?url=…` | 302 redirect for allowlisted provider URLs |

---

## Honest scope

| Capability | What it really does |
|---|---|
| **Search results** | Parsed from the public search pages/JSON of APKMirror, Google Play, Aptoide, APKCombo and TapTap; best-effort, no API keys |
| **Package names & icons** | Taken from Google Play / TapTap / Aptoide results; APKMirror rows contribute versions, developers and release links |
| **APKMirror availability** | Frequently rate-limited (429) or Cloudflare-challenged — APKScope then falls back to Play/Aptoide results or the provider search page |
| **Version history & checksums** | From Aptoide's version API, F-Droid's package API and APKCombo's version list: version, size, MD5, date and source per row — not scraped from challenge-protected detail pages |
| **Downloads** | Streamed on demand through the Cloudflare Worker from the original host's URL (allowlisted hosts, `.apk` only); APKScope stores, caches and re-hosts no files |
| **Accounts & data** | None — no auth, no user database, no uploads, no cookies; theme/language/recent apps stay in your `localStorage` |
| **Analytics** | Vercel Analytics only (cookie-free page views) in production — no tracking profile, no cross-site cookies |
| **Rate limiting** | 15 searches/minute per IP on the API, with a 10-minute shared result cache |
| **Filters (source / platform / sort)** | Visual controls on the current result list; they do not re-query providers |

These limits are shown in the UI and docs rather than simulated away.

---

## Security research note

> **Only test applications and programs where you have authorization.** Verify package
> name, version, signing information, source and compatibility before installing any APK
> or bundle.

APKScope is a discovery interface: it points you at sources, it does not vouch for them.

---

## Contributing

**Fork it → find a bug → fix it in your fork → open a PR.**

Before opening a PR:

1. `npm run build` in `web/` completes with no errors (this runs the type and lint gate).
2. Keep the honest-scope rules: never present a link as a hosted file, never fabricate a
   result when a provider blocks the request.
3. Keep the no-storage promise: no auth, no user data, no uploads.

---

## Support

Free and open-source. If it saves you time, ⭐ **star the repo** — it helps others
discover the project.

<div align="center">

### ❤️ Sponsor jojin1709

<a href="https://github.com/sponsors/jojin1709"><img src="https://img.shields.io/badge/GitHub_Sponsors-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor on GitHub" height="32"></a>&nbsp;
<a href="https://github.com/sponsors/jojin1709"><img src="https://img.shields.io/badge/Become_a_Sponsor-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Become a Sponsor"></a>

Sponsorship keeps APKScope maintained: provider parsing across markup changes,
rate-limit handling, docs, and the road to more sources.

<br/>

<a href="https://github.com/jojin1709/apkscope/stargazers"><img src="https://img.shields.io/badge/⭐_Star-7B61FF?style=for-the-badge&logo=github&logoColor=white" alt="Star on GitHub"></a>

**Developed by JOJIN JOHN**

</div>

> **Manage APK discovery and testing only on systems you own or are authorised to administer.**
