# Hackathon Toolkit — Free & Near-Free Stack

A reference list of open-source libraries and free-tier APIs, organized by category. No local model hosting required anywhere on this list.

---

## AI / LLM Inference

| Tool | Notes | Key needed |
|---|---|---|
| **Groq** | Fastest inference (LPU hardware), `llama-3.3-70b-versatile` for quality, `openai/gpt-oss-20b` for speed, `groq/compound` for built-in web search + code execution | Yes, free signup |
| **Gemini (Google AI Studio)** | Frontier model access, generous free tier, 1M token context on Pro | Yes, free signup |
| **OpenRouter** | One key, many models, good fallback layer if primary provider rate-limits mid-demo | Yes, free signup |
| **Cerebras / Cloudflare Workers AI** | Secondary fallbacks, no card required | Yes, free signup |

**Skip:** Hugging Face Inference API as a primary backend (free tier too thin to rely on), OpenAI free tier (effectively unusable without paid deposit), local model hosting via Ollama (too heavy for hackathon timelines).

---

## Speech-to-Text (STT)

| Tool | Notes |
|---|---|
| **Web Speech API** (`SpeechRecognition`) | Browser-native, zero backend, zero API key. Fastest to wire up for a live demo. |
| **Groq-hosted Whisper** (`whisper-large-v3-turbo`) | Better accuracy than browser API, same key as your chat backend |
| **AssemblyAI** | Free tier; use only if you need diarization/sentiment beyond plain transcription |
| **Sarvam AI (Saaras v3)** | **Best pick for Indian languages** — 22 languages, code-mixing (Hinglish/Tanglish), speaker diarization, word-level timestamps, <150ms latency. Free credits on signup, then ~₹1.5/min. You've used this before (NurseSync). Use whenever the demo involves Hindi/regional-language speech, not just English. |

## Text-to-Speech (TTS)

| Tool | Notes |
|---|---|
| **Web Speech API** (`speechSynthesis`) | Browser-native, zero setup, robotic but instant |
| **ElevenLabs (free tier)** | Natural-sounding voices, capped monthly characters |
| **Sarvam AI (Bulbul v3)** | Natural Indian-language voices, 35+ speakers, emotion control, Hinglish code-switching, correct Indian name pronunciation. Free tier with 1,000 credits, then ~₹30/10K chars. Pairs with Saaras STT above for a full Indian-language voice loop. |

**Skip:** Self-hosted TTS/voice-cloning (Kokoro, Coqui XTTS, Bark, Chatterbox, RVC) — GPU-heavy, not worth the setup time.

---

## Translation

| Tool | Notes |
|---|---|
| **LibreTranslate** | Open-source, public free instances available, rate-limited |
| **Google Translate API (free tier)** | Reliable, capped usage |
| **Sarvam AI (Mayura)** | Open-weights translation model, 22 Indian languages, better at structured long-form text and code-mixed content than generic translators |
| **Prompt your existing LLM** | Fastest path if accuracy needs are casual — no new integration |

## OCR / Document Reading

| Tool | Notes |
|---|---|
| **Tesseract.js** | Runs client-side in-browser via WASM, no backend, no key, good for clean printed text |
| **Groq/Gemini vision models** | Send image directly to a vision-capable model for messier docs (handwriting, tables, receipts) — better accuracy than classic OCR |

---

## Maps & Location

| Tool | Notes |
|---|---|
| **Leaflet.js** | Lightweight interactive maps, no key required |
| **OpenStreetMap tiles** | Free tile source, pairs with Leaflet |
| **Nominatim** | Free OSM geocoding (address → lat/lng) |

---

## Backend / Auth / Storage

| Tool | Notes |
|---|---|
| **Supabase** | Postgres + auth + storage + realtime, generous free tier, covers most backend needs |
| **Vercel** | Frontend + serverless function hosting |
| **Railway / Render** | For a persistent Express/FastAPI server (WebSockets, long-running jobs) |
| **Cloudinary (free tier)** | Image upload, hosting, on-the-fly transforms |

---

## Frontend Utility Libraries

| Tool | Use case |
|---|---|
| **shadcn/ui** | Copy-paste Tailwind components, fast polish |
| **Recharts / Chart.js** | Data visualization |
| **react-hook-form + Zod** | Form handling + schema validation, shared between client and server |
| **date-fns / day.js** | Lightweight date handling |
| **Fuse.js** | Client-side fuzzy search, no backend search service needed |
| **QRCode.js** | Instant QR generation, nice demo touch ("scan to open") |
| **PDF.js / pdf-lib** | Client-side PDF reading/generation |

---

## Backend Utility Libraries

| Tool | Use case |
|---|---|
| **express-rate-limit** | Protect AI routes from burning free-tier quota |
| **Zod** | Request validation on Express routes |
| **cors, dotenv** | Standard Express setup, already in your stack |

---

## Agent Frameworks (only if genuinely multi-agent)

| Tool | Notes |
|---|---|
| **CrewAI** (Python) | Fastest path to a working multi-agent demo, role-based DSL |
| **LangGraph** (Python) | More production-grade, steeper setup — overkill for most hackathons |
| **Vercel AI SDK** (JS) | If staying Node-only and just need tool-calling, not full multi-agent |

**Default recommendation:** skip agent frameworks entirely unless your concept specifically requires multiple coordinating agents. A direct function-calling loop against Groq/Gemini is faster to build and debug.

---

## Quick Decision Rules

- **Need it to just work with zero setup?** → Browser-native APIs (Web Speech, Tesseract.js) win every time.
- **Need better quality than the browser gives you?** → Route through Groq/Gemini, which you already have keys for, before adding a new provider.
- **Considering a new API key?** → Ask if an existing provider (Groq, Gemini, Supabase) already covers it before adding a new signup and a new free-tier limit to track.
- **Considering an agent framework?** → Only if the concept is multi-agent by design; otherwise it's added complexity with no demo-day payoff.
- **Demo involves Hindi or a regional Indian language?** → Reach for Sarvam AI (STT/TTS/translation) instead of generic global tools — it's specifically trained on Indian accents, code-mixing, and phrasing, and will sound/perform noticeably better than a Whisper/ElevenLabs fallback for this use case.
