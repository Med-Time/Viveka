from qdrant_client import QdrantClient
from langchain_huggingface import HuggingFaceEmbeddings
import os
from dotenv import load_dotenv
from pathlib import Path

# # Get the project root (3 levels up from current file)
# project_root = Path(__file__).parent.parent.parent.parent.parent
# # Load .env from project root
# dotenv_path = project_root / '.env'
# load_dotenv(dotenv_path=dotenv_path)
load_dotenv()
print(os.getenv("QDRANT_URL"))

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")

# Load embedding model (e.g., MiniLM)
embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

print(QDRANT_API_KEY)
print(QDRANT_URL)
print(COLLECTION_NAME)
# Qdrant client (for cloud)
client = QdrantClient(url=QDRANT_URL,api_key=QDRANT_API_KEY)


def embed_query(text: str):
    return embedding_model.embed_query(text)

def search_similar_chunks(query_text: str, top_k: int = 5, score_threshold: float = 0.5):
    query_vector = embed_query(query_text)
    try:
        results = client.search(
            collection_name=COLLECTION_NAME,  # Use the variable
            query_vector=query_vector,
            limit=top_k,
            score_threshold=score_threshold
        )
        return results
    except Exception as e:
        print(f"Error searching collection '{COLLECTION_NAME}': {e}")
        # You could check if the collection exists
        collections = client.get_collections()
        print(f"Available collections: {collections}")
        return []