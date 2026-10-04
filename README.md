<div align="center">

# APKScope

### Direct Android Build & Package Discovery for Security Research

**Access the live web service:**  
### 🌐 [apkscope.vercel.app](https://apkscope.vercel.app)

A high-performance web platform built specifically for security researchers, bug bounty hunters, and reverse engineers. Search across **APKMirror, Google Play, Aptoide, APKCombo, TapTap, F-Droid, GitHub Releases, IzzyOnDroid, and Uptodown** — inspect package names, version rollback histories, permissions, checksums, and signers with **zero logins, zero file uploads, and zero API keys required**.

<br/>

[![Live Service](https://img.shields.io/badge/Live_App-apkscope.vercel.app-38bdf8?style=for-the-badge&logo=vercel&logoColor=white)](https://apkscope.vercel.app)
[![Developer](https://img.shields.io/badge/Developer-JOJIN_JOHN-60a5fa?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/jojin-john/)
[![License](https://img.shields.io/badge/License-Proprietary_/_All_Rights_Reserved-34d399?style=for-the-badge)](./LICENSE)

<br/>

![](https://img.shields.io/badge/No_Login_Required-0f1520?style=for-the-badge&labelColor=0f1520&color=38bdf8)
&nbsp;![](https://img.shields.io/badge/Zero_Uploads-0f1520?style=for-the-badge&labelColor=0f1520&color=38bdf8)
&nbsp;![](https://img.shields.io/badge/Zero_File_Hosting-0f1520?style=for-the-badge&labelColor=0f1520&color=34d399)
&nbsp;![](https://img.shields.io/badge/Multi--Source_Engine-0f1520?style=for-the-badge&labelColor=0f1520&color=60a5fa)
&nbsp;![](https://img.shields.io/badge/Edge_Runtime-0f1520?style=for-the-badge&labelColor=0f1520&color=818cf8)

<br/>

<a href="https://apkscope.vercel.app"><img src="https://img.shields.io/badge/Open_APKScope_Web_App-38bdf8?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Open APKScope Web App"></a>&nbsp;
<a href="https://www.linkedin.com/in/jojin-john/"><img src="https://img.shields.io/badge/Connect_on_LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>&nbsp;
<a href="#license--terms"><img src="https://img.shields.io/badge/View_License_Terms-30363D?style=for-the-badge&logoColor=white" alt="License"></a>

</div>

---

## Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Sources & Integrations](#sources--integrations)
- [Security & Bug Bounty Workflow](#security--bug-bounty-workflow)
- [Zero Hosting Guarantee](#zero-hosting-guarantee)
- [Developer & Credits](#developer--credits)
- [License & Terms](#license--terms)

---

## Overview

Security researchers and bug bounty analysts constantly need authentic, untouched Android APKs to extract target endpoints, inspect exported components, audit permissions, or analyze version rollbacks. Most mirror sites require logins, inject invasive ads, or enforce slow download caps.

**APKScope** solves this by offering an edge-accelerated, transparent discovery engine:
- **No account, no login, and no cookies** needed.
- **No file uploads or binary hosting** — downloads stream directly from original mirror hosts via a Cloudflare Worker proxy.
- **Deep security inspection** — package names, version branches, certificate fingerprints, MD5/SHA256 hashes with one-click VirusTotal lookups, and Android attack surface analysis.

👉 **Ready to search? Use the online service directly at [apkscope.vercel.app](https://apkscope.vercel.app).**

---

## How It Works

```
Browser ──► https://apkscope.vercel.app/api/search?q=…  (Edge-cached, rate-limited)
                 │
                 ├──► APKMirror       Public releases, build versions, developer info
                 ├──► Google Play     Official store identifiers, package names, icons
                 ├──► Aptoide         Version archives, file sizes, MD5 hashes, signers
                 ├──► APKCombo        Extended mirror catalog & historical releases
                 ├──► TapTap          Asian market releases & direct package mapping
                 ├──► F-Droid         Open-source repository & verified reproducible builds
                 ├──► GitHub Releases Untouched FOSS release binaries (.apk assets)
                 ├──► IzzyOnDroid     Independent curated open-source repositories
                 └──► Uptodown        Historical rollback archive endpoints
                               │
            Resolution Engine ──► Exact package lookup & version deduplication
                               │
       Cloudflare Worker Proxy ──► Streams .apk live from allowlisted original hosts
                                   (Nothing stored, zero hosting, real-time progress)
```

---

## Key Features

| Feature | Description |
|---|---|
| **Multi-Engine Search** | Aggregates and dedupes results across 8+ global app catalogs simultaneously. |
| **Direct Package Resolution** | Quickly find true `com.vendor.app` IDs for reverse engineering and manifest analysis. |
| **Historical Version Rollback** | Browse and download historical builds to test for security regressions or patch diffs. |
| **Streamed Proxy Downloads** | Clean, fast downloads with live byte progress directly from allowlisted upstream hosts. |
| **Hash Verification** | Real-time MD5 and SHA256 hashes linked to VirusTotal intelligence checks. |
| **Attack Surface Inspector** | Highlights critical permissions (`CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, etc.) and exported components. |
| **QR Code Scanner Integration** | Scan a generated on-screen QR code with your test device to download APKs directly to test hardware. |
| **Offline-Capable PWA** | Progressive Web App installable on desktop and mobile devices with zero clutter. |
| **System-Adaptive UI** | Clean dark/light modes crafted with custom Optical Aperture vector branding. |

---

## Sources & Integrations

APKScope queries authoritative public catalogs and repositories:
- **Google Play Store**: Official Android package IDs, categories, ratings, and artwork.
- **APKMirror**: Verified developer uploads, release versions, and variant architectures.
- **Aptoide**: Comprehensive version archives, binary sizes, signatures, and MD5 hashes.
- **APKCombo**: Direct mirror links for APK and split bundle versions.
- **TapTap**: Asian and global game/app package discovery.
- **F-Droid & IzzyOnDroid**: FOSS builds built from source with transparent build logs.
- **GitHub Releases**: Direct untouched binaries from open-source security tool releases.
- **Uptodown**: Deep version rollback archives for historical vulnerability research.

---

## Security & Bug Bounty Workflow

APKScope was architected specifically for ethical hackers, penetration testers, and bug bounty researchers:

1. **Reconnaissance**: Enter target app name or domain to retrieve all matching Android package identifiers.
2. **Version Pinning**: Check version history to identify old versions vulnerable to known CVEs or retired API endpoints.
3. **Integrity Validation**: Cross-reference binary checksums with VirusTotal prior to running apps inside an emulator or sandbox.
4. **Attack Surface Mapping**: Review requested Android dangerous permissions and exported attack surfaces before dynamic analysis.

> **Responsible Research Notice**: Only test applications, services, and devices where you possess explicit testing authorization or participate in a legitimate Bug Bounty program.

---

## Zero Hosting Guarantee

APKScope **does not host, store, cache, or redistribute any APK files**. 

All download operations stream on-the-fly directly from verified upstream mirror servers via an allowlisted proxy. No user data, passwords, or personal files are ever uploaded or retained.

---

## Developer & Credits

**Designed and developed by JOJIN JOHN**  
- **LinkedIn**: [https://www.linkedin.com/in/jojin-john/](https://www.linkedin.com/in/jojin-john/)
- **Live Platform**: [https://apkscope.vercel.app](https://apkscope.vercel.app)

---

## License & Terms

Copyright (c) 2026 **JOJIN JOHN**. All Rights Reserved.

- This web application is publicly accessible and free to use for security research, vulnerability assessment, and educational analysis at [apkscope.vercel.app](https://apkscope.vercel.app).
- **Unauthorized copying, cloning, code scraping, mirroring, re-distribution, or re-hosting of the source code, architecture, or brand assets is strictly prohibited.**
- For commercial inquiries, licensing permissions, or partnerships, please contact the developer via [LinkedIn](https://www.linkedin.com/in/jojin-john/).

See the full [LICENSE](./LICENSE) file for complete terms and conditions.
