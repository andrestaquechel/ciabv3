# Box Studio / CIABv2

Build **Mini Box** content with Ideate → Topics & Articles → sections → Review → Publish.

**Live:** https://ciabv2-gilt.vercel.app  
**Repo:** https://github.com/seeing-in-color/CIABv2  

Pushes to `main` auto-deploy via GitHub Actions → Vercel.

## Left nav flow

1. **Topic IDEATE** — brainstorm + AI topic suggestions  
2. **Topics & Articles** → Cover → Welcome → One-Pager → Chat  
3. **Review REVIEW** — checklist of all sections  
4. **Publish** button — sync to Google Slides (needs OAuth)

## Google OAuth setup (fixes `invalid_client`)

That error means Client ID/Secret are missing or wrong in Vercel.

### 1. Google Cloud project
1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project  
2. Enable **Google Slides API** + **Google Drive API**

### 2. OAuth consent screen
1. **APIs & Services → OAuth consent screen**  
2. External (or Internal for Workspace)  
3. Add yourself as a **test user** while status is Testing  
4. Scopes: `presentations` + `drive.file`

### 3. Create Web OAuth client
1. **Credentials → Create credentials → OAuth client ID**  
2. Type: **Web application**  
3. **Authorized JavaScript origins**
   - `https://ciabv2-gilt.vercel.app`
4. **Authorized redirect URIs**
   - `https://ciabv2-gilt.vercel.app/api/auth/callback/google`
5. Copy **Client ID** + **Client Secret**

### 4. Add env vars in Vercel
Project → Settings → Environment Variables (Production + Preview):

| Name | Value |
|------|--------|
| `AUTH_GOOGLE_ID` | your Client ID |
| `AUTH_GOOGLE_SECRET` | your Client Secret |
| `AUTH_URL` | `https://ciabv2-gilt.vercel.app` |

Redeploy (or push any commit). Then use **Connect Google** on the site.

### 5. Template for Publish
1. Upload `templates/mini-box-master.pptx` to Drive → Open with Google Slides  
2. Set `MINI_BOX_TEMPLATE_ID` to the ID in the Slides URL  

## Other env

| Variable | Notes |
|----------|-------|
| `AUTH_SECRET` | Already set on Vercel |
| `GIPHY_API_KEY` | Already set |
| `OPENAI_API_KEY` | Optional for live AI |
