from groq import Groq
from sentence_transformers import SentenceTransformer

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

from .config import GROQ_API_KEY, SUPABASE_ENABLED, SUPABASE_KEY, SUPABASE_URL

client = Groq(api_key=GROQ_API_KEY)
embedder = SentenceTransformer("all-MiniLM-L6-v2")  # for document search

supabase: "Client" = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_ENABLED else None
