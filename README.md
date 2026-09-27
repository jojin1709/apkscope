<div align="center">

# APKScope

### No-login, no-upload Android build discovery — built for security research

**A real Next.js application** — searches run server-side on the edge, results are parsed
from public APKMirror and Google Play search pages, and every download button opens the
original provider page: APKScope **never hosts, stores or re-distributes a single APK file**.

**Built for** security researchers · pentesters · bug bounty hunters who want package names,
versions and source links — **without an account, an upload or an API key**.

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
&nbsp;![](https://img.shields.io/badge/APKMirror_%2B_Google_Play-7B61FF?style=for-the-badge&labelColor=0D1117&logoColor=white)
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

- **🔎 Real results, no fake data** — the search API fetches the public APKMirror search
  page and Google Play search server-side, then parses real rows: app name, **package
  name**, **version**, developer and icon. When a provider blocks the request, it falls
  back to the provider's own search URL instead of inventing entries.
- **📦 Package names first** — Google Play results give you the exact
  `com.vendor.app` identifier, Play Store link and icon; APKMirror results give you the
  release page, version number and developer.
- **🚪 Nothing to log into** — no accounts, no database, no saved searches, no profiles,
  no uploads, no cookies. Open the page, search, click through to the source.
- **⬇️ Links, never files** — download buttons open the original provider page, so the
  current download destination is always decided by the source site. APKScope holds no
  APK bytes and cannot serve a stale or tampered one.
- **⚡ One page, one API route** — a single Next.js page (hero search, source filters,
  results list, detail panel) plus one edge function; no third-party search API, no
  provider API keys, no queue, no worker required to run.
- **🤝 Honesty over hype** — provider scraping is best-effort: if APKMirror rate-limits
  (429) or Cloudflare challenges the request, the UI says so and points at the source
  page rather than pretending a direct APK URL exists.

---

## How discovery works

```
browser ──► /api/search?q=…  (Next.js edge route)
                 │
                 ├──► APKMirror public search HTML ── parse rows, versions, icons
                 ├──► Google Play public search HTML ── parse packages, icons, links
                 │
                 └──► merged JSON: name · package · version · source link · icon
                                      │
                 fallback: provider search URL when a source blocks the request
```

- **No keys.** Neither provider is called with an API key — only public search pages are
  read, the same pages a browser would open.
- **Best effort by design.** A blocked or rate-limited fetch degrades to a working
  provider link, never to fabricated results.
- **Optional Worker.** `worker/` is a separate Cloudflare Worker that can return the same
  provider links (`/api/search`) and validate-then-redirect (`/api/resolve`) — it only
  ever redirects to `apkmirror.com` / `apkpure.com` hostnames.

---

## The UI

| Area | What it does |
|:---:|---|
| 🔍 **Hero search** | Search field with Enter-to-search and popular query chips |
| 🗂 **Sources panel** | Source / platform / sort filters for the result list |
| 📋 **Results list** | Real app icon, name, package name, version badge, source badge — click to select |
| 🧾 **Detail panel** | Versions view with **Open on APKMirror / Google Play** and **Play Store** buttons, source disclaimer, browse-releases link |
| ⚠️ **Honest notice** | Every page states that sources are external and APKScope hosts nothing |

The **Details / Screenshots / Similar** tabs are visual placeholders — only the Versions
view is implemented, and it links out instead of embedding provider content.

---

## Quick start

Requires **Node.js 18+**.

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

# optional — the Cloudflare Worker
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
5. Deploy. No environment variables required.

Full steps: [deploy-vercel.md](deploy-vercel.md).

---

## Cloudflare Worker

The worker is optional — the web app works on its own.

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

| Endpoint | What it returns |
|---|---|
| `/health` | `{ ok: true, service: "apkscope-resolver" }` |
| `/api/search?q=…` | provider search links (APKMirror, APKPure, Google Play) |
| `/api/resolve?url=…` | 302 redirect — **only** for `apkmirror.com` / `apkpure.com` URLs |

---

## Honest scope

| Capability | What it really does |
|---|---|
| **Search results** | Parsed from public APKMirror + Google Play search HTML; best-effort, no API keys |
| **Package names & icons** | Taken from Google Play results; APKMirror rows contribute versions, developers and release links |
| **APKMirror availability** | Frequently rate-limited (429) or Cloudflare-challenged — APKScope then falls back to Play results or the provider search page |
| **Variant / architecture table** | Not scraped — provider detail pages are challenge-protected, so the UI links to the source release page instead |
| **Downloads** | Always a link to the original provider page; APKScope stores no files and issues no download URLs |
| **Accounts & data** | None — no auth, no user database, no saved searches, no uploads, no analytics profile |
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

1. `npm run build` in `web/` completes with no errors.
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
