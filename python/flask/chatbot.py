from fastapi import FastAPI
import os,sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from python.chatbot.langchat import ask_bot

app = FastAPI()

@app.get("/chat")
def chat(query: str):
    response = ask_bot(query)
    return {"response": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
