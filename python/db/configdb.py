from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')

DATABASE_NAME = "store_db"
collections = ["orders", "inventory", "customers"]

def connect_db():
    """Establishes a connection to the MongoDB database and returns the database instance."""
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DATABASE_NAME]
    
    existing_collections = db.list_collection_names()
    missing_collections = [col for col in collections if col not in existing_collections]

    if missing_collections:
        print(f"Warning: The following collections are missing - {missing_collections}")

    print("Connected to database")
    return db