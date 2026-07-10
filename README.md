# Box Studio / CIABv2

Build **Mini Box** (and later CIAB) content with topic + article inputs, AI drafts, Giphy, local render preview, and Google Slides sync.

## Live app

After deploy, Vercel URL will be in the project dashboard. GitHub pushes to `main` auto-deploy.

## Local / Vercel env

Copy `.env.example` → `.env.local` (local) or set in Vercel Project Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | For Slides sync | OAuth web client |
| `AUTH_URL` | Yes on Vercel | Your `https://….vercel.app` URL |
| `GIPHY_API_KEY` | Recommended | Live GIF search |
| `OPENAI_API_KEY` | Optional | Live AI (mock works without) |
| `MINI_BOX_TEMPLATE_ID` | For Slides copy | Upload `templates/mini-box-master.pptx` to Google Slides and paste the presentation ID |

Google OAuth redirect URI (production):

`https://YOUR_DOMAIN/api/auth/callback/google`

## Template

`templates/mini-box-master.pptx` is the Mini Box master (from the “When AI Follows the Wrong Instructions” example). Upload to Drive → Open with Google Slides → set `MINI_BOX_TEMPLATE_ID`.

## Scripts

```bash
npm install
npm run dev
npm run build
```
