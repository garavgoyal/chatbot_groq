import os
from pathlib import Path

from dotenv import load_dotenv

# loads the .env sitting next to the backend package, no matter where uvicorn was launched from
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY)

CORS_ORIGINS = ["http://localhost:5173"]
