from pymongo import MongoClient
import os
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')
DATABASE_NAME = "test_store_db"
COLLECTION_NAME = "inventory"

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DATABASE_NAME]
inventory_collection = db[COLLECTION_NAME]
order_collection = db["orders"]
feedback_collection = db["feedback"]  # ✅ New Feedback Collection