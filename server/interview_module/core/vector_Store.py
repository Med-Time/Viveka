from qdrant_client import QdrantClient
from langchain_huggingface import HuggingFaceEmbeddings
import os
from dotenv import load_dotenv
from pathlib import Path

# Get the project root (3 levels up from current file)
project_root = Path(__file__).parent.parent.parent.parent.parent
# Load .env from project root
dotenv_path = project_root / '.env'
load_dotenv(dotenv_path=dotenv_path)

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "interview_docs")

# Load embedding model (e.g., MiniLM)
embedding_model = HuggingFaceEmbeddings(
    model_name=os.getenv("EMBEDDING_MODEL_NAME")
)

# Qdrant client (for cloud)
client = QdrantClient(url=QDRANT_URL,api_key=QDRANT_API_KEY)


def embed_query(text: str):
    return embedding_model.embed_query(text)

def search_similar_chunks(query_text: str, top_k: int = 5, score_threshold: float = 0.5):
    query_vector = embed_query(query_text)
    results = client.search(
        collection_name="subject_documents",
        query_vector=query_vector,
        limit=top_k,
        score_threshold=score_threshold
    )
    return results
