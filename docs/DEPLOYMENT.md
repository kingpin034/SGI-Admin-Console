# Vercel deployment

Deploy this folder as its own Vercel project, separate from Referral and Stockpoint.

1. Add the folder contents to a Git repository and import it into Vercel.
2. Select **Vite**. If the repository contains more than this app, set Root Directory to **SGI-Admin Console**.
3. Use these settings (already included in vercel.json):

| Setting | Value |
| --- | --- |
| Install | npm ci |
| Build | npm run build |
| Output directory | dist |
| Node.js | 22.12 or newer |
| Environment variables | None |

The app is a static frontend; no database, serverless function, credentials, or provider configuration is required. vercel.json includes SPA fallback rewrites for direct page links and standard response headers.

Before deploying:

```sh
npm ci
npm test
npm run build
npm run preview
```

Preview at http://127.0.0.1:4178/. Check a direct route such as /members or /commissions as well as the dashboard. Deployment has not been performed as part of this delivery.

All records are sample data, isolated to each browser tab. Changes reset on reload. Staff permissions and financial actions are simulated locally.
