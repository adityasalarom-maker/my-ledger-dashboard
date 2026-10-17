---
name: pwa-mobile-deployment
description: Trigger when building, validating, or deploying the mobile PWA, service worker cache configurations, web manifest assets, or publishing updates to GitHub Pages.
---

# Skill: Progressive Web App (PWA) & Mobile Deployment

## Overview
Ensures mobile installation capability, offline service worker caching, manifest configuration, and seamless deployment to GitHub Pages.

## Operational Workflow

### Step 1: Web App Manifest Verification
Ensure `manifest.json` at root satisfies Chrome PWA installability requirements:
- `name`: "My Ledger Dashboard"
- `short_name`: "Ledger"
- `start_url`: "./mobile.html"
- `display`: "standalone"
- `background_color`: "#0b0f19"
- `theme_color`: "#0b0f19"
- `icons`: Includes valid PNG icons (`icon-192.png`, `icon-512.png` with `"purpose": "any maskable"`).

### Step 2: Service Worker Cache Management
Inspect `sw.js`:
- Increment cache version token (e.g., `ledger-cache-v2.1`) whenever assets are modified.
- Ensure critical assets are pre-cached:
  - `mobile.html`, `mobile.css`, `mobile.js`
  - `assistant.html`, `assistant.css`, `assistant.js`
  - `manifest.json`, icons.
- Verify stale-while-revalidate or network-first strategy for live ledger data.

### Step 3: Mobile UX & Touch Audit
- Verify 48x48px minimum touch target size for all interactive buttons.
- Ensure viewport meta tag is present:
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">`
- Verify iOS home screen compatibility:
  `<meta name="apple-mobile-web-app-capable" content="yes">`

### Step 4: Deployment & Git Release
1. Run local lint and syntax verification.
2. Stage and commit changes to `main`.
3. Push to `origin main` to trigger GitHub Pages static hosting build.
4. Verify HTTP 200 on live endpoint:
   `https://adityasalarom-maker.github.io/my-ledger-dashboard/mobile.html`
