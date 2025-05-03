from qdrant_client import QdrantClient
from langchain_community.embeddings import HuggingFaceEmbeddings
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")



client = QdrantClient(url="https://your-qdrant-url")
#embedding_model = OpenAIEmbeddings()
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

def generate_question_rag(state):
    concept = state["curriculum"][state["current_concept_index"]]
    query_vector = embedding_model.embed_query(concept)

    results = client.search(
        collection_name="interview_docs",
        query_vector=query_vector,
        limit=3
    )
    
    context = "\n".join([res.payload["text"] for res in results])
    prompt = f"""Using the following context, generate a question for the topic '{concept}':

    {context}
    """
    question = llm.predict(prompt)
    state["current_question"] = question
    return state
