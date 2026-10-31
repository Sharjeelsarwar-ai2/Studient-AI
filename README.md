# Studient AI — React + Vite rebuild

Glassmorphic rebuild of the Streamlit Studient AI app. Deep emerald/jade + warm ivory
("Emerald Study" palette: jade #0B6E4F, emerald #10B981, deep green #064E3B,
warm ivory #FAF7F0, sand #F1EBDD, ink #1C2B26).

## Architecture
- **Browser-side extraction** (pdf.js, mammoth, JSZip/PPTX XML, plain text) in `src/lib/extract.js`
  — the API never receives whole documents, only selected context (≤12,000 chars).
- **API routes** (`api/`): `generate.js` builds prompts server-side (`api/_prompts.js`) and
  calls Groq `openai/gpt-oss-120b` at temperature 0.2; `health.js` reports key presence.
- **Key**: only `process.env.GROQ_API_KEY` on the server. Never a `VITE_*` key.
  Without it, the API returns `{ok:false, error:"KEY_NOT_CONFIGURED"}` and the UI
  shows a friendly message. Stub mode (`STUDIENT_STUB_GROQ=1`) is for local
  testing only and returns canned responses.
- **State**: React state + localStorage (history, attempts, flashcard Leitner review,
  summaries) honouring private mode and retention. No backend, no accounts.

## What changed vs Streamlit (deliberate)
- OCR: browser-side tesseract.js (WASM) fallback for scanned PDF pages; no poppler.
- Video Overview: no MP4/ffmpeg. Same Groq storyboard plan, rendered as an
  in-browser narrated slide presentation (Web Speech API), plus script download.
- Speech: browser Web Speech API for summary read-aloud and video narration.
  No server audio, no MP3 download of generated speech.
- Privacy: no Fernet/server files — documents live only in browser memory;
  localStorage controls operate on local data.

## Develop
```bash
npm install
npm run build
npm run dev
```
Set `GROQ_API_KEY` in Vercel Settings → Environment Variables, then redeploy.
