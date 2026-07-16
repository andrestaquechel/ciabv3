<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deploy & Git

- **"Push" / "deploy" / "commit" = production.** When Andres says push, deploy, or commit, commit the current work and push it straight to `main` (which auto-deploys to production). Do not leave it on a feature branch as a preview.
- **GitHub repo:** https://github.com/andrestaquechel/ciabv3 — always push to `main` on this repo.
- **Production URL:** https://ciabv2-gilt.vercel.app (Vercel project `ciabv2`, Git-linked to `andrestaquechel/ciabv3`).
- **Deploys:** Vercel auto-deploys on push to `main`. GitHub Actions runs `npm run build` only (no Vercel token workflow).
- **Push auth:** Use the `andrestaquechel` GitHub account (work). `gh` CLI may default to `seeing-in-color`; use keychain credentials or `gh auth switch` if push is denied.
