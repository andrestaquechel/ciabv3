# Box Studio / CIABv3

Build **Mini Box** content with a native PowerPoint builder. Preview slides live, then **download a PPTX** and upload to Google Drive → Open with Google Slides when needed.

**Live:** https://ciabv2-gilt.vercel.app  
**Repo:** https://github.com/andrestaquechel/ciabv3  

Pushes to `main` auto-deploy via Vercel (Git integration).

## Flow

1. **Topic IDEATE** — brainstorm + AI topic ideas  
2. **Topics & Articles** → Cover → Welcome → One-Pager → Chat (+ GIFs)  
3. **Review** — checklist  
4. **Publish / Download PPTX** — 7-slide Mini Box file  

No Google OAuth required.

## After download

1. Upload the `.pptx` to Google Drive  
2. Right-click → **Open with → Google Slides**  
3. Share / distribute as usual  

## Env (Vercel)

| Variable | Notes |
|----------|-------|
| `GIPHY_API_KEY` | Live GIF search (set) |
| `ANTHROPIC_API_KEY` | Optional live AI (Claude) for generate, research, and Knowledge Base |
| `ANTHROPIC_MODEL` | Optional Claude model override (default `claude-sonnet-4-6`) |
| `AUTH_SECRET` | Optional leftover; not required for PPTX flow |

## Template

Exports follow the **Shadow AI Mini Box** structure from `templates/mini-box-master.pptx` (7 slides: cover, welcome, dividers, one-pager, chat + GIF slots).
