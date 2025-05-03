from qdrant_client import QdrantClient
#from langchain.embeddings import OpenAIEmbeddings

client = QdrantClient(url="https://your-qdrant-url")
from langchain_community.embeddings import HuggingFaceEmbeddings
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def check_docs(state):
    query = f"{state['subject']} {state['goal']}"
    query_vector = embedding_model.embed_query(query)
    
    results = client.search(
        collection_name="interview_docs",
        query_vector=query_vector,
        limit=3,
        score_threshold=0.7
    )
    
    state["use_rag"] = len(results) > 0
    return state
