from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get MongoDB URI from environment
MONGO_URI = os.getenv('MONGO_URI')

# Database and Collection names
DATABASE_NAME = "store_db"
ORDER_COLLECTION_NAME = "orders"

def get_order_collection():
    """Establishes a connection to the orders collection."""
    # Initialize MongoDB Client
    mongo_client = MongoClient(MONGO_URI)
    # Access the database and collection
    db = mongo_client[DATABASE_NAME]
    order_collection = db[ORDER_COLLECTION_NAME]
    
    return order_collection
