import os
import datetime
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd
from langchain.text_splitter import RecursiveCharacterTextSplitter
from python.db.configdb import connect_db
from python.db.gemini_config import gemini_model
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatVertexAI

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Define documents folder
DOCUMENTS_FOLDER = r"D:\Deloitte\Prototype\python\attachments"

# Connect to MongoDB
db = connect_db()
customers_collection = db["customers"]
inventory_collection = db["inventory"]
orders_collection = db["orders"]
feedback_collection = db["feedback"]

# Google Vertex AI Configuration
PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"D:\Deloitte\Prototype\python\services\fresh-airfoil-445517-q1-0df53973cc7e.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

# Initialize Vector Store
vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)

# Function to Load PDFs & Text Files
def load_documents_from_folder(folder_path):
    """Loads all PDFs and text files from the given folder."""
    documents = []
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        
        if filename.endswith(".pdf"):
            loader = PyPDFLoader(file_path)
        elif filename.endswith(".txt"):
            loader = TextLoader(file_path)
        else:
            continue  # Skip unsupported files

        docs = loader.load()
        documents.extend(docs)
    
    return documents

# Load Data from MongoDB Collections
def load_collection_data(collection):
    return list(collection.find({}, {"_id": 0}))

def get_all_data():
    return {
        "customers": load_collection_data(customers_collection),
        "inventory": load_collection_data(inventory_collection),
        "orders": load_collection_data(orders_collection),
        "feedback": load_collection_data(feedback_collection),
    }

# Split Data into Chunks
def build_records_from_collection(data, collection_name):
    records = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    
    for idx, record in enumerate(data):
        text = str(record)
        chunks = text_splitter.split_text(text)
        
        for chunk_idx, chunk in enumerate(chunks):
            records.append({
                "id": f"{collection_name}_{idx}_chunk_{chunk_idx}",
                "text": chunk,
                "source": collection_name,
                "record_type": collection_name,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
    
    return records

# Convert Records to Documents
def build_documents(records):
    docs = []
    
    for rec in records:
        metadata = {
            "id": rec["id"],
            "source": rec["source"],
            "record_type": rec.get("record_type", "general"),
            "timestamp": rec["timestamp"],
            "priority": "high" if rec["source"] in ["pdf", "technical_docs"] else "normal"
        }
        docs.append(Document(page_content=rec["text"], metadata=metadata))
    
    return docs

# Upsert Documents into Vector Store
def upsert_documents(new_docs):
    try:
        existing_docs = vector_store.get()["documents"]
        existing_ids = {doc["id"] for doc in existing_docs}  # Fix: Accessing ID correctly
        
        new_filtered_docs = [doc for doc in new_docs if doc.metadata["id"] not in existing_ids]

        if new_filtered_docs:
            vector_store.add_documents(new_filtered_docs)
            print(f"Added {len(new_filtered_docs)} new documents to vector store.")
        else:
            print("No new documents to add.")

    except Exception as e:
        print("Error during upsert:", e)

# Refresh & Update Vector Store (MongoDB + Folder Documents)
def refresh_data_and_update_vector_store():
    print("Loading data from MongoDB...")
    data = get_all_data()
    
    print("Loading documents from folder...")
    folder_documents = load_documents_from_folder(DOCUMENTS_FOLDER)

    # Convert database records into document format
    all_records = (
        build_records_from_collection(data["customers"], "customers") +
        build_records_from_collection(data["inventory"], "inventory") +
        build_records_from_collection(data["orders"], "orders") +
        build_records_from_collection(data["feedback"], "feedback")
    )
    
    # Convert records and folder documents to LangChain Documents
    db_documents = build_documents(all_records)
    all_documents = db_documents + folder_documents

    print(f"Total documents to upsert: {len(all_documents)}")
    upsert_documents(all_documents)

# Retrieve Similar Documents
def retrieve_similar_docs(query, k=5):
    if not vector_store:
        return []
    
    results = vector_store.similarity_search(query, k=k)
    
    sorted_results = sorted(results, key=lambda doc: (
        doc.metadata.get("priority", "normal") == "high",
        doc.metadata.get("timestamp", "")
    ), reverse=True)

    return sorted_results[:k]

# AI Chatbot Response
def ask_bot(query):
    relevant_docs = retrieve_similar_docs(query, k=5)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    prompt = f"""
You are a knowledgeable AI assistant.
Use the following context to answer the query accurately.
If the context does not provide enough information, indicate that and ask for clarification.

Context:
{context}

Query:
{query}

Answer:
"""
    response = gemini_model.generate_content(prompt)
    
    if hasattr(response, "text"):
        return {"response": response.text.strip()}
    else:
        return {"error": "Invalid response format from Google Vertex AI"}

# Flask Routes
@app.route("/")
def home():
    return jsonify({"message": "Chatbot API is running!"})

@app.route("/ask", methods=["POST"])
def chatbot_response():
    data = request.json
    query = data.get("query", "")

    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    response = ask_bot(query)
    return jsonify(response)

@app.route("/refresh", methods=["POST"])
def refresh_data():
    refresh_data_and_update_vector_store()
    return jsonify({"message": "Data refreshed and updated in vector store."})

# Run the Flask App
if __name__ == "__main__":
    app.run(debug=True)
