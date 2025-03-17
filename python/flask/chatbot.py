import os
import sys
from datetime import datetime, timezone
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from flask import session
import uuid
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from python.db.configdb import connect_db
from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd
from python.db.gemini_config import gemini_model
from langchain.text_splitter import RecursiveCharacterTextSplitter
from python.flask.thread import call_routes

load_dotenv()

# Initialize database connection
db = connect_db()
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]
chat_history_collection = db["chat_history"]


# Google Cloud Configuration
PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"D:\Deloitte\Prototype\python\services\fresh-airfoil-445517-q1-0df53973cc7e.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

# Flask App Initialization
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "sexyflasky")
# Load Data from MongoDB
def load_collection_data(collection):
    try:
        return list(collection.find({}, {"_id": 0}))
    except Exception as e:
        print(f"Error loading from collection: {e}")
        return []

def store_chat_history(session_id, query, response):
    """Store chat interactions in MongoDB using session ID"""
    chat_history_collection.insert_one({
        "session_id": session_id,
        "query": query,
        "response": response,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

def get_chat_history(session_id, limit=10):
    """Retrieve chat history for a specific session"""
    history = list(chat_history_collection.find(
        {"session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit))
    
    return history

@app.before_request
def before_request():
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        
# ✅ Step 1: Extract and Verify PDF Content
def process_pdf(pdf_path):
    print("\n📌 Processing PDF:", pdf_path)

    try:
        loader = PyPDFLoader(pdf_path)
        documents = loader.load()

        # Split the text into smaller chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
        pdf_texts = text_splitter.split_documents(documents)

        print("\n✅ Extracted Text Samples from PDF:")
        for i, doc in enumerate(pdf_texts[:3]):  # Print first 3 chunks
            print(f"\nChunk {i+1}:\n{doc.page_content[:500]}")

        docs = []
        for i, doc in enumerate(pdf_texts):  # Fix indentation here
            metadata = {
                "id": f"pdf_chunk_{i}",
                "source": "User Manual",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "priority": "medium"
            }
            docs.append(Document(  # This should be inside the loop
                page_content=doc.page_content,
                metadata=metadata
            ))

        return docs  # Return correctly

    except Exception as e:
        print("❌ Error processing PDF:", e)
        return []

# ✅ Step 2: Ensure Data is Stored in ChromaDB
def check_vector_store():
    if not vector_store:
        print("\n❌ Vector store not initialized.")
        return

    stored_docs = vector_store.get()
    if "documents" in stored_docs and stored_docs["documents"]:
        print("\n✅ ChromaDB contains stored documents.")
        for i, doc in enumerate(stored_docs["documents"][:5]):  # Print first 5 docs
            print(f"\n📌 Stored Document {i+1}:\n{doc[:500]}")  # Print first 500 characters
        print(f"\nTotal Documents Stored: {len(stored_docs['documents'])}")
    else:
        print("\n❌ No documents found in ChromaDB. Something went wrong.")

# ✅ Step 3: Build Records for Vector Storage
def build_records_from_collection(data, collection_name):
    records = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    for idx, record in enumerate(data):
        text = str(record)
        chunks = text_splitter.split_text(text)
        for chunk_idx, chunk in enumerate(chunks):
            if not chunk or chunk.strip() == "":
                continue
                
            records.append({
                "id": f"{collection_name}_{idx}_chunk_{chunk_idx}",
                "text": chunk,
                "source": collection_name,
                "record_type": collection_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    return records

# ✅ Step 4: Store Documents in ChromaDB
vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)

def upsert_documents(new_docs):
    if not vector_store:
        print("❌ Error: Vector store is not initialized.")
        return

    try:
        existing_docs = vector_store.get()
        existing_ids = set(existing_docs["ids"]) if existing_docs and "ids" in existing_docs else set()

        new_filtered_docs = [doc for doc in new_docs if doc.metadata["id"] not in existing_ids]

        if new_filtered_docs:
            vector_store.add_documents(new_filtered_docs)
            print(f"✅ Added {len(new_filtered_docs)} new documents to vector store.")
        else:
            print("⚠️ No new documents to add.")

    except Exception as e:
        print("❌ Error during upsert:", e)
        
# Function to Convert Records into Document Objects
def build_documents(records):
    docs = []
    for rec in records:
        metadata = {
            "id": rec["id"],
            "source": rec["source"],
            "record_type": rec.get("record_type", "general"),
            "timestamp": rec["timestamp"],
            "priority": "high" if rec["source"] in ["pdf", "app_docs", "technical_docs"] else "normal"
        }
        docs.append(Document(
            page_content=rec["text"],
            metadata=metadata
        ))
    return docs


# ✅ Step 5: Refresh Data and Update Vector Store
@app.route("/refresh-data", methods=["POST"])
def refresh_data():
    customers = load_collection_data(customers_collection)
    inventory = load_collection_data(inventory_collection)
    orders = load_collection_data(orders_collection)
    feedback = load_collection_data(feedback_collection)

    # Process structured data
    all_records = (
        build_records_from_collection(customers, "customers") +
        build_records_from_collection(inventory, "inventory") +
        build_records_from_collection(orders, "orders") +
        build_records_from_collection(feedback, "feedback")
    )

    # ✅ Fix: Now `build_documents` is correctly called
    docs = build_documents(all_records)

    # Add PDF content to vector store
    pdf_docs = process_pdf(r"D:\Deloitte\Prototype\python\attachments\User Mannual.pdf")  # Ensure correct path
    docs.extend(pdf_docs)

    # Upsert to ChromaDB
    upsert_documents(docs)
    
    return jsonify({"message": "Data refreshed with PDF and vector store updated."})

# ✅ Step 6: Ensure Retrieval Prioritizes User Manual
def retrieve_similar_docs(query, k=10):
    if vector_store is None:
        return []
    
    try:
        results = vector_store.similarity_search(query, k=k)

        # Sort results to prioritize relevant data
        sorted_results = sorted(results, key=lambda doc: (
            "User Manual" in doc.metadata.get("source", ""),  # Prioritize PDF
            doc.metadata.get("source", "") in ["orders", "inventory", "analytics"],  # Other categories
            doc.metadata.get("priority", "normal") == "medium",
            doc.metadata.get("timestamp", "")
        ), reverse=True)

        print("\n📌 Retrieved Similar Documents:")
        for i, doc in enumerate(sorted_results[:3]):  # Print first 3 retrieved docs
            print(f"\nResult {i+1}:\n{doc.page_content[:500]}")

        return sorted_results[:k]
    
    except Exception as e:
        print("❌ Error retrieving similar docs:", e)
        return []

# ✅ Step 7: Chatbot Endpoint
@app.route("/ask", methods=["POST"])
def ask_bot():
    data = request.json
    query = data.get("query", "").strip()
    
    # Get or create session ID
    session_id = session.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id

    if not query:
        return jsonify({"error": "Query is required"}), 400

    # Get chat history for context
    chat_history = get_chat_history(session_id)
    history_text = ""
    
    if chat_history:
        history_text = "Previous conversation:\n"
        for entry in reversed(chat_history):  # Chronological order
            history_text += f"User: {entry['query']}\nAssistant: {entry['response']}\n\n"

    # Get relevant documents
    relevant_docs = retrieve_similar_docs(query, k=10)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])

    prompt = f"""
You are an AI assistant with expertise in:
- **Order Management**
- **Inventory Tracking**
- **Product Analytics**
- **User Manual Navigation**

Use the **provided context and chat history** to answer the query accurately.

**Chat History:**
{history_text}

**Context:**
{context}

**Query:**
{query}

**Instructions:**
1. If the context contains relevant **order, inventory, analytics, or PDF** information, answer directly.
2. If missing details, **explain what additional info is needed**.
3. **Do not ask the user to check the documentation—assume you are the documentation.**
4. Reference previous conversations when relevant.

**Answer:**
"""

    response = gemini_model.generate_content(prompt)
    response_text = response.text.strip() if hasattr(response, "text") else ""

    # Store the interaction in chat history
    if response_text:
        store_chat_history(session_id, query, response_text)

    if response and hasattr(response, "text"):
        return jsonify({"response": response_text, "session_id": session_id})
    else:
        return jsonify({"error": "Invalid response format from Google Vertex AI"}), 500

@app.route("/chat-history", methods=["GET"])
def get_session_chat_history():
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({"error": "No active session"}), 400
        
    limit = int(request.args.get("limit", 10))
    
    history = get_chat_history(session_id, limit)
    
    return jsonify({"history": history, "session_id": session_id})

@app.route("/end-session", methods=["POST"])
def end_session():
    session_id = session.get('session_id')
    if not session_id:
        return jsonify({"error": "No active session"}), 400
    
    # Clear chat history for this session
    chat_history_collection.delete_many({"session_id": session_id})
    
    # Clear session
    session.pop('session_id', None)
    
    return jsonify({"message": "Session ended and chat history cleared"})

call_routes()


# ✅ Step 8: Run Flask App
if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")
    
