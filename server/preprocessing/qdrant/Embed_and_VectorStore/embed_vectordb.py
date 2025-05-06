import json
import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# Load Sentence Transformer model (384-dim)
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Loaded Sentence Transformer model 'all-MiniLM-L6-v2'")

# Initialize Qdrant client    
try:
    qdrant_client = QdrantClient(
        url="https://8a790b96-ec0d-4915-8c1a-583dc928f647.eu-west-2-0.aws.cloud.qdrant.io",
        api_key=os.getenv("api_key_qdrant"),
    )
    print("✅ Connected to Qdrant Cloud!")
except Exception as e:
    print(f"❌ Failed to connect to Qdrant Cloud: {e}")
    exit(1)

# Define Qdrant collection name
collection_name = "subject_documents"

# Reset collection if exists
if qdrant_client.collection_exists(collection_name):
    print(f"⚠️ Collection '{collection_name}' exists. Deleting it...")
    qdrant_client.delete_collection(collection_name)

# Create collection (384 vector size)
print(f"🚀 Creating collection '{collection_name}'...")
qdrant_client.create_collection(
    collection_name=collection_name,
    vectors_config=models.VectorParams(
        size=384,  # Sentence Transformer vector size
        distance=models.Distance.COSINE
    )
)

# Input chunked JSON from your chunking.py
input_dir = "C:/Users/sk984/OneDrive/Documents/qdrant/Chunked_Subjects"
output_dir = "C:/Users/sk984/OneDrive/Documents/qdrant/Metada_Qdrant"
os.makedirs(output_dir, exist_ok=True)

# Store metadata
metadata = []

# Walk through the directory (including subdirectories)
for root, dirs, files in os.walk(input_dir):
    for filename in files:
        if filename.startswith('.') or not filename.endswith(".json"):
            continue

        filepath = os.path.join(root, filename)
        print(f"🔍 Opening file: {filepath}")
        
        with open(filepath, "r", encoding="utf-8") as f:  # Fix encoding issue
            chunked_data = json.load(f)

            print(f"📚 Processing file: {filename} (sections: {len(chunked_data)})")

            for section_id, section in enumerate(chunked_data):
                section_title = section.get("section_title", "").strip()
                content_list = section.get("content", [])
                content_text = " ".join(content_list).strip()

                # Skip empty sections
                if not section_title or not content_text:
                    print(f"⚠️ Skipping section {section_id} in {filename} (empty title/content)")
                    continue

                # Embed title and content
                title_embedding = model.encode(section_title).tolist()
                content_embedding = model.encode(content_text).tolist()

                print(f"🔎 Section {section_id} | Title Embedding: {len(title_embedding)} | Content Embedding: {len(content_embedding)}")

                # Generate unique IDs (UUID)
                title_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{filename}_{section_id}_title"))
                content_point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{filename}_{section_id}_content"))

                # Store metadata
                metadata.append({
                    "section_id": section_id,
                    "section_title": section_title,
                    "content": content_text,
                    "filename": filename
                })

                # Upload to Qdrant
                qdrant_client.upsert(
                    collection_name=collection_name,
                    points=[  
                        models.PointStruct(
                            id=title_point_id,
                            vector=title_embedding,
                            payload={
                                "type": "title",
                                "section_title": section_title,
                                "content": content_text,
                                "filename": filename
                            }
                        ),
                        models.PointStruct(
                            id=content_point_id,
                            vector=content_embedding,
                            payload={
                                "type": "content",
                                "section_title": section_title,
                                "content": content_text,
                                "filename": filename
                            }
                        )
                    ]
                )

# Use the base name of the input JSON filename (without the .json extension)
metadata_filename = os.path.splitext(filename)[0] + "_metadata.json"
metadata_filepath = os.path.join(output_dir, metadata_filename)

# Save metadata
with open(metadata_filepath, "w") as f:
    json.dump(metadata, f, indent=4)

print(f"✅ Embeddings uploaded to Qdrant and metadata saved successfully in {metadata_filename}!")
