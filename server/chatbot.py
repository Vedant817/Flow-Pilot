import os
import datetime
from config.dbConfig import db
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd
from config.gemini_config import gemini_model
from langchain.text_splitter import RecursiveCharacterTextSplitter
import glob

load_dotenv()
inventory_collection = db["inventory"]
feedback_collection = db["feedback"]
orders_collection = db["orders"]
customers_collection = db["customers"]

PROJECT_ID = os.getenv("GOOGLE_PROJECT_ID")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"D:\Deloitte\Prototype\server\services\fresh-airfoil-445517-q1-4e804f7d94e2.json"
aiplatform.init(project=PROJECT_ID, location="us-central1")
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

def load_collection_data(collection):
    return list(collection.find({}, {"_id": 0}))

customers = load_collection_data(customers_collection)
inventory = load_collection_data(inventory_collection)
orders = load_collection_data(orders_collection)
feedback = load_collection_data(feedback_collection)

df = pd.DataFrame(customers + inventory + orders + feedback)

def load_pdf(file_path):
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    return [page.page_content for page in pages]

def build_records_from_collection(data, collection_name):
    records = []
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    for idx, record in enumerate(data):
        # Convert each record to string; you might later customize formatting
        text = str(record)
        chunks = text_splitter.split_text(text)
        for chunk_idx, chunk in enumerate(chunks):
            records.append({
                "id": f"{collection_name}_{idx}_chunk_{chunk_idx}",
                "text": chunk,
                "source": collection_name,            # Identifies the collection (e.g., "customers")
                "record_type": collection_name,         # Can be used to filter results later
                "timestamp": datetime.datetime.utcnow().isoformat()
            })
    return records

records_customers = build_records_from_collection(customers, "customers")
records_inventory = build_records_from_collection(inventory, "inventory")
records_orders = build_records_from_collection(orders, "orders")
records_feedback = build_records_from_collection(feedback, "feedback")

all_records = records_customers + records_inventory + records_orders + records_feedback

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
        docs.append(Document(
            page_content=rec["text"],
            metadata=metadata
        ))
    return docs

docs = build_documents(all_records)

vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)

def upsert_documents(new_docs):
    try:
        existing_docs = vector_store.get()["documents"]
        existing_ids = {doc.metadata["id"] for doc in existing_docs}
        new_filtered_docs = [doc for doc in new_docs if doc.metadata["id"] not in existing_ids]
        
        if new_filtered_docs:
            vector_store.add_documents(new_filtered_docs)
            print(f"Added {len(new_filtered_docs)} new documents to vector store.")
        else:
            print("No new documents to add.")
    
    except Exception as e:
        print("Error during upsert:", e)

upsert_documents(docs)

def refresh_data_and_update_vector_store():
    customers = load_collection_data(customers_collection)
    inventory = load_collection_data(inventory_collection)
    orders = load_collection_data(orders_collection)
    feedback = load_collection_data(feedback_collection)
    
    records_customers = build_records_from_collection(customers, "customers")
    records_inventory = build_records_from_collection(inventory, "inventory")
    records_orders = build_records_from_collection(orders, "orders")
    records_feedback = build_records_from_collection(feedback, "feedback")
    
    all_records = records_customers + records_inventory + records_orders + records_feedback
    docs = build_documents(all_records)
    upsert_documents(docs)

def retrieve_similar_docs(query, k=100):
    if not vector_store:
        return []

    results = vector_store.similarity_search(query, k=k)

    sorted_results = sorted(results, key=lambda doc: (
        doc.metadata.get("priority", "normal") == "high",
        doc.metadata.get("timestamp", "")
    ), reverse=True)

    return sorted_results[:k]

def ask_bot(query):
    relevant_docs = retrieve_similar_docs(query, k=100)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    prompt = f"""
You are a knowledgeable and precise AI assistant.
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