"""Environment variables and static constants, loaded once and imported
everywhere else that needs them. Keeping this separate from clients.py
avoids circular imports (clients.py needs these values; several
controllers need both)."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")  # loads .env sitting next to this file, no matter where uvicorn was launched from

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY)

# Lets your React app (running on a different port) talk to this server.
# Configurable via ALLOWED_ORIGINS in .env (comma-separated) so deploying
# somewhere other than localhost doesn't require editing source.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful, friendly assistant. "
        "Always follow the user's formatting instructions exactly — "
        "if they ask for a specific number of lines, words, sentences, or bullet points, "
        "obey that limit strictly even if it means leaving out detail you'd normally include. "
        "Do not add extra explanation, caveats, or padding beyond what was asked for."
    ),
}

WEATHER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": (
                "Get current real-time weather. Either name a city, or set "
                "use_current_location to true when the user means wherever they are "
                "right now — 'here', 'outside', 'my location', or any weather question "
                "that names no place at all."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    # Deliberately no example city: an example here acts as a
                    # default, and the model was calling get_weather("Amritsar")
                    # for every unlocated question purely because that name was
                    # the nearest thing to a hint in this schema.
                    # Nullable on purpose: asked about "here", the model emits
                    # {"city": null, "use_current_location": true}, and a plain
                    # "string" type makes Groq reject its own output with a 400.
                    "city": {
                        "type": ["string", "null"],
                        "description": "Name of the city to look up. Null or omitted for the user's own location.",
                    },
                    "use_current_location": {
                        "type": "boolean",
                        "description": "True when the user means their own location rather than a named city.",
                    },
                },
                "required": []
            }
        }
    }
]

RECENT_MESSAGE_LIMIT = 8   # how many latest chat messages to send in full

# --- Conversation titles (the headings shown in the sidebar) ---
DEFAULT_TITLE = "New Chat"   # placeholder until the first exchange gets named
MAX_TITLE_LENGTH = 48
TITLE_MODEL = "llama-3.3-70b-versatile"   # no reasoning channel, so a tiny token budget is enough
TITLE_PROMPT = (
    "You write short headings for chat conversations in a sidebar. "
    "Given the opening exchange, reply with a 3-6 word heading describing what "
    "the conversation is actually about, in title case. "
    "Describe only what is really there — never invent a topic, a setting, or a "
    "purpose that the exchange doesn't show. If there is no real subject yet "
    "(a greeting, small talk), say so plainly, e.g. 'Quick Hello'. "
    "Keep the normal capitalisation of names and technical terms (FastAPI, iPhone, npm). "
    "Reply with the heading only — no quotes, no trailing punctuation, no preamble."
)

MAX_DOCUMENT_SIZE = 10 * 1024 * 1024   # 10MB — plenty for a PDF/TXT upload, stops a runaway request
MAX_IMAGE_SIZE = 8 * 1024 * 1024       # 8MB
ALLOWED_DOCUMENT_EXTENSIONS = (".pdf", ".txt", ".md")
MAX_CHUNKS_PER_USER = 300   # doc_store is in-memory and never persisted — cap it so one chatty
                            # user uploading lots of documents can't grow it without bound

TOKEN_USAGE_MARKER = "\n\n<<<TOKEN_USAGE:{tokens}>>>"  # kept in sync with frontend's marker regex

# Cheap pre-filter deciding whether a message is worth an extra tool-check
# call. It used to miss plain phrasings like "how hot is it here today",
# because it only matched the exact phrase "hot outside".
WEATHER_KEYWORDS = (
    "weather", "temperature", "forecast", "rain", "raining", "snow", "snowing",
    "sunny", "cloudy", "overcast", "humid", "humidity", "wind", "windy",
    "degrees", "climate", "storm", "thunder", "drizzle", "fog", "haze",
    "outside", "umbrella", "celsius", "fahrenheit", "sunshine", "muggy",
    "how hot", "how cold", "how warm", "chilly", "freezing",
)
