import os
import sys
from pymongo import MongoClient
import pandas as pd
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_chroma import Chroma
from langchain.schema import Document
from google.cloud import aiplatform
from langchain_google_vertexai import VertexAIEmbeddings
import google.generativeai as genai

# Load environment variables
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
load_dotenv()

# Set Google Credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"D:\Deloitte\Prototype\python\chatbot\fresh-airfoil-445517-q1-0df53973cc7e.json"

# MongoDB Setup
MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["test_store_db"]
customers_collection = db["customers"]
inventory_collection = db["inventory"]
orders_collection = db["orders"]
feedback_collection = db["feedback"]

# Load data from MongoDB
customers = list(customers_collection.find({}, {"_id": 0}))
inventory = list(inventory_collection.find({}, {"_id": 0}))
orders = list(orders_collection.find({}, {"_id": 0}))
feedback = list(feedback_collection.find({}, {"_id": 0}))

df = pd.DataFrame(customers + inventory + orders + feedback)

# Load PDF data
def load_pdf(file_path):
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    return [page.page_content for page in pages]

pdf_texts = load_pdf(r"D:\Deloitte\Prototype\python\chatbot\business report.pdf")
all_texts = df.to_dict(orient="records") + [{"text": text} for text in pdf_texts]

# Initialize Vertex AI
PROJECT_ID = os.getenv("PROJECT_ID")
aiplatform.init(project=PROJECT_ID, location="us-central1")

# Initialize Embeddings
embeddings = VertexAIEmbeddings(model="text-embedding-004", project=PROJECT_ID)

# Create Vector Store# Ensure each record has "text" key, else use a default value
docs = [Document(page_content=record.get("text", str(record))) for record in all_texts]

vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",
)
vector_store.add_documents(docs)  # Add documents to the vector store

# Define retrieval function
def retrieve_similar_docs(query):
    if not vector_store:
        return []
    return vector_store.similarity_search(query, k=5)

# Initialize Gemini AI
API_KEY = os.getenv("GENAI_API_KEY")
genai.configure(api_key=API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# Define chatbot function
def ask_bot(query):
    # Retrieve relevant documents
    relevant_docs = retrieve_similar_docs(query)

    # Create prompt with retrieved context
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    prompt = f"""
    You are a helpful AI assistant. Answer the query based on the provided context.

    Context:
    {context}

    Query:
    {query}

    Answer:
    """

    # Generate response using Gemini
    response = gemini_model.generate_content(prompt)

    # ✅ Extract only the text content to avoid serialization issues
    if hasattr(response, "text"):
        return {"response": response.text.strip()}
    else:
        return {"error": "Invalid response format from Google Vertex AI"}

