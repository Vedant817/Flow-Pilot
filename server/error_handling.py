from fastapi import FastAPI
from config.dbConfig2 import connect_db
from bson import ObjectId
from datetime import datetime
import json

app = FastAPI()

# Connect to MongoDB
db = connect_db()
error_collection = db["errors"]

# Helper function to serialize MongoDB documents
def serialize_error(error):
    return {
        "id": str(error["_id"]),  # Convert ObjectId to string
        "errorMessage": error.get("errorMessage", ""),
        "type": error.get("type", ""),
        "severity": error.get("severity", ""),
        "timestamp": error["timestamp"].isoformat() if isinstance(error.get("timestamp"), datetime) else error.get("timestamp")
    }

# API to fetch all errors and return as JSON
@app.get("/api/errors")
async def get_errors():
    errors_cursor = error_collection.find({})
    errors = [serialize_error(error) async for error in errors_cursor]
    return {"errors": errors}
