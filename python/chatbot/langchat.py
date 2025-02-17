from pymongo import MongoClient
import os,sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)

db = client["test_store_db"]
customers_collection = db["customers"]
inventory_collection = db["inventory"]
orders_collection = db["orders"]
feedback_collection = db["feedback"]

from langchain_community.document_loaders import PyPDFLoader

def load_pdf(file_path):
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    return [page.page_content for page in pages]

from langchain_chroma import Chroma
from langchain_google_vertexai import VertexAIEmbeddings
import pandas as pd

customers = list(customers_collection.find({}, {"_id": 0}))
inventory = list(inventory_collection.find({}, {"_id": 0}))
orders = list(orders_collection.find({}, {"_id": 0}))
feedback = list(feedback_collection.find({}, {"_id": 0}))

df = pd.DataFrame(customers + inventory + orders + feedback)

pdf_texts = load_pdf(r"D:\Deloitte\Prototype\python\chatbot\business report.pdf")
all_texts = df.to_dict(orient="records") + [{"text": text} for text in pdf_texts]

# Create vector store using OpenAI embeddings
embeddings = VertexAIEmbeddings(model="text-embedding-004")
vector_store = Chroma(
    collection_name="customer",
    embedding_function=embeddings,
    persist_directory="./chroma_langchain_db",  # Where to save data locally, remove if not necessary
)

def retrieve_similar_docs(query):
    return vector_store.similarity_search(query, k=5)

import google.generativeai as genai
from vectorstore import retrieve_similar_docs


API_KEY = os.getenv("GENAI_API_KEY")
genai.configure(api_key=API_KEY)

# Initialize Gemini Model
gemini_model = genai.GenerativeModel("gemini-2.0-pro")

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
    return response.text.strip()



