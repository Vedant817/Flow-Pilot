import os
import datetime
import sys
import shutil
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from python.db.configdb import connect_db
from python.db.gemini_config import gemini_model
from langchain.chains import RetrievalQA
from langchain_community.chat_models import ChatVertexAI

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

# Vector Store Directory
VECTOR_STORE_DIR = "./chroma_langchain_db"

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

# Refresh & Update Vector Store (MongoDB + Folder Documents)
# Define separate directories for vector stores
VECTOR_STORE_DB_DIR = "./chroma_mongodb_db"
VECTOR_STORE_DOCS_DIR = "./chroma_documents_db"

def refresh_data_and_update_vector_store():
    global vector_store_db, vector_store_docs  # Maintain two global vector stores

    print("🔄 Clearing existing vector stores...")
    if os.path.exists(VECTOR_STORE_DB_DIR):
        shutil.rmtree(VECTOR_STORE_DB_DIR)
    if os.path.exists(VECTOR_STORE_DOCS_DIR):
        shutil.rmtree(VECTOR_STORE_DOCS_DIR)

    print("📥 Loading data from MongoDB...")
    data = get_all_data()
    
    print("📂 Loading documents from folder...")
    folder_documents = load_documents_from_folder(DOCUMENTS_FOLDER)

    # Process structured data (MongoDB)
    all_db_records = (
        build_records_from_collection(data["customers"], "customers") +
        build_records_from_collection(data["inventory"], "inventory") +
        build_records_from_collection(data["orders"], "orders") +
        build_records_from_collection(data["feedback"], "feedback")
    )
    db_documents = build_documents(all_db_records)

    # Process unstructured documents (PDFs, text files)
    processed_folder_docs = []
    for idx, doc in enumerate(folder_documents):
        if doc.page_content.strip():
            doc.metadata.update({
                "id": f"pdf_doc_{idx}",
                "source": "pdf",
                "record_type": "technical_docs",
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "priority": "high"
            })
            processed_folder_docs.append(doc)

    print(f"📊 Total structured records: {len(db_documents)}")
    print(f"📊 Total unstructured documents: {len(processed_folder_docs)}")

    # Initialize two separate vector stores
    print("🆕 Reinitializing structured database vector store...")
    vector_store_db = Chroma(
        collection_name="structured_data",
        embedding_function=embeddings,
        persist_directory=VECTOR_STORE_DB_DIR,
    )

    print("🆕 Reinitializing unstructured documents vector store...")
    vector_store_docs = Chroma(
        collection_name="unstructured_docs",
        embedding_function=embeddings,
        persist_directory=VECTOR_STORE_DOCS_DIR,
    )

    # Add documents to respective vector stores
    if db_documents:
        vector_store_db.add_documents(db_documents)
    if processed_folder_docs:
        vector_store_docs.add_documents(processed_folder_docs)

    print("✅ Vector stores updated successfully.")

# Retrieve Similar Documents
def retrieve_similar_docs(query, k=5):
    """Determines query type and retrieves relevant documents from the appropriate vector store."""
    if not query or not query.strip():
        return []

    # Simple classification: Check if the query relates to structured data or documents
    if any(keyword in query.lower() for keyword in ["customer", "order", "inventory", "feedback"]):
        relevant_store = vector_store_db
        print("📊 Query detected as **structured database query**")
    else:
        relevant_store = vector_store_docs
        print("📂 Query detected as **unstructured document query**")

    if not relevant_store:
        return []

    results = relevant_store.similarity_search(query, k=k)

    sorted_results = sorted(results, key=lambda doc: (
        doc.metadata.get("priority", "normal") == "high",
        doc.metadata.get("timestamp", "")
    ), reverse=True)

    return sorted_results[:k]

# AI Chatbot Response
def ask_bot(query):
    if not query or not query.strip():
        return {"error": "Query cannot be empty. Please enter a valid question."}

    relevant_docs = retrieve_similar_docs(query, k=5)
    
    if not relevant_docs:
        return {"error": "No relevant documents found for the query."}

    context = "\n\n".join([doc.page_content for doc in relevant_docs if doc.page_content.strip()])
    
    if not context.strip():
        return {"error": "Insufficient context to generate a response."}

    prompt = f"""
You are a highly knowledgeable AI assistant with access to both structured database records and unstructured documents.  
Your goal is to provide **accurate, precise, and well-structured answers** based on the available information.

### **Guidelines for Answering Queries:**
1. **Database Queries:**  
   - If the query is about customer details, inventory, orders, or feedback, answer strictly based on the structured database records.  
   - If exact data is unavailable, state that the data is not found **but DO NOT generalize or assume facts**.  

2. **Application Related Queries:**  
   - If the query is about navigation, application, or user manual, refer to the extracted documents.  
   - Use the most relevant document snippets and avoid speculation.  
   
3. **When Data is Limited:**  
   - If sufficient information is not available, make an educated response using general domain knowledge **but clearly specify that it is not from the records or documents**.  
   - Never say *"Context not provided"*. Instead, say **"No exact match found, but here's what I can infer..."**  

---
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
    return jsonify({"message": "✅ Data refreshed and updated in vector store."})

# Run the Flask App
if __name__ == "__main__":
    app.run(debug=True)
