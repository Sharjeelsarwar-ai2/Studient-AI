# 🧠 Studient AI

**Turn any PDF into exam-ready study material — summaries, MCQs, flashcards, and a Q&A tutor, powered by Groq's Llama/GPT-OSS models.**

AI StudyMate is a Streamlit web app that takes a lecture note or textbook PDF and generates structured study content on demand: summaries, important questions, multiple-choice questions, flashcards, long/short answer questions, key concepts, a difficulty analysis, a full practice test, and a "chat with your PDF" tutor — all grounded strictly in the uploaded document.

---

## ✨ Features

| Tab | What it does |
|---|---|
| 📚 **Summary** | Generates a structured, exam-focused summary (overview, concepts, definitions, facts, processes, revision points) |
| 📝 **Important Questions** | Produces likely exam questions based on core concepts in the material |
| ❓ **MCQs** | Multiple-choice questions with correct answers and explanations |
| 🧠 **Flashcards** | Question/answer flashcards for quick revision |
| 📖 **Long Questions** | Detailed "explain/discuss/analyze/compare" style exam questions |
| 🎯 **Short Questions** | Definition- and fact-based short-answer questions |
| 🔍 **Key Concepts** | Extracts and explains the most important concepts, with exam relevance |
| 📊 **Difficulty Analysis** | Breaks the material into easy/medium/hard topics and suggests study priority |
| 🧪 **Practice Test** | Full multiple-choice mock test generated from the document |
| 💬 **Ask PDF** | Ask free-form questions; answers are retrieved from and grounded in the uploaded PDF only |
| 🤖 **AI Search** | Can give answers by searching from outside of pdf to give more detailed and compiled answer, only when ask pdf option is checked|

All generation is scoped to the uploaded document — the app is instructed not to invent facts outside the source material. Will give only when outside relevent knowledge is demended.

---

## 🏗️ How it works

```
PDF Upload
   │
   ▼
pypdf → text extraction & cleaning
   │
   ▼
Chunking + keyword-relevance selection
   │
   ▼
Groq Chat Completions API (OpenAI GPT-OSS / Llama models)
   │
   ▼
Structured study material (summary, MCQs, flashcards, Q&A, etc.)
```

Instead of sending an entire document to the model, the app splits the PDF into chunks and selects the chunks most relevant to the current task (or question) before calling Groq — this keeps responses focused and reduces token usage on long documents.

---

## 🛠️ Tech Stack

- **[Streamlit](https://streamlit.io/)** — UI and app framework
- **[Groq API](https://console.groq.com/)** (via the official `groq` Python SDK) — LLM inference
- **[pypdf](https://pypi.org/project/pypdf/)** — PDF text extraction
- Custom glassmorphic CSS for the UI (no external component libraries)

**Model:** configurable via `MODEL_NAME` in `app.py` (currently `openai/gpt-oss-120b` on Groq — see [Known Limitations](#-known-limitations--roadmap)).

---

## 📁 Project Structure

```
AI-StudyMate/
│
├── app.py             # Full application: UI, PDF handling, Groq calls
└── requirements.txt   # streamlit, groq, pypdf
```

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/Studient-AI.git
cd Studient-AI
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Get a Groq API key

Create a free key at the [Groq Console](https://console.groq.com/).

### 4. Set your API key locally

Create `.streamlit/secrets.toml` in the project root:

```toml
GROQ_API_KEY = "gsk_your_actual_key_here"
```

> ⚠️ Never commit `secrets.toml` or hardcode your API key in `app.py`. Add it to `.gitignore`.

### 5. Run the app

```bash
streamlit run app.py
```

Open the local URL Streamlit prints (typically `http://localhost:8501`).

---

## ☁️ Deploying to Streamlit Community Cloud

1. Push only `app.py` and `requirements.txt` to a public (or connected private) GitHub repo.
2. Go to [Streamlit Community Cloud](https://streamlit.io/cloud) and sign in with GitHub.
3. Click **Create app** → select your repo, branch (`main`), and main file path (`app.py`).
4. Before deploying, open **Advanced settings → Secrets** and add:
   ```toml
   GROQ_API_KEY = "gsk_your_actual_key_here"
   ```
5. Click **Deploy**. Streamlit installs `requirements.txt` and starts the app.
6. Once live, your key stays in Streamlit's encrypted secrets store — it's never exposed in your GitHub source.

To update the key later: **App → ⋮ → Settings → Secrets**.

---

## ⚠️ Known Limitations & Roadmap

This is an actively evolving project — being transparent about current gaps:

- **Single-file architecture.** All logic currently lives in `app.py`. Splitting into modules (PDF/chunking, Groq client, UI) is a planned refactor for maintainability.
- **Hardcoded model name.** `MODEL_NAME` points to a specific Groq model, which can be deprecated. Model selection should move to a config/secrets value with a fallback.
- **Keyword-overlap retrieval.** "Ask PDF" and topic-targeted generation currently select relevant chunks by literal keyword overlap, not semantic similarity — it can miss content phrased differently from the question. A lightweight embedding-based retrieval step is a natural next improvement.
---

## 📌 Notes

- Works best with **text-based PDFs**. Scanned/image-only PDFs need OCR first (not currently built in).
- Never commit your `GROQ_API_KEY` — use `.streamlit/secrets.toml` locally and Streamlit Cloud Secrets in production.

---

## 📄 License

MIT — feel free to fork and adapt.
