

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv
from datetime import datetime
import json

# LangChain + Ollama + Pinecone
from langchain_ollama import ChatOllama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import MessagesPlaceholder
from langchain.chains import ConversationChain
from langchain.schema.messages import AIMessage, HumanMessage



load_dotenv()
app = Flask(__name__)
CORS(app)

# === MongoDB Setup === #
client = MongoClient(os.getenv("MONGO_URI"))
db = client["mindmate"]
students = db["students"]



# === Teacher Credentials === #
TEACHER_ID = "teacher123"
TEACHER_PASSWORD = "password123"

# === Pinecone + LangChain Setup === #
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = PineconeVectorStore(index=index, embedding=embeddings)

retriever = vector_store.as_retriever(search_type="similarity_score_threshold", search_kwargs={"k": 3, "score_threshold": 0.5})
llm = ChatOllama(model="gemma3:1b", temperature=0,max_tokens=50)

@app.route('/')
def index():
    return render_template('index.html')

# === Student Signup === #
@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    if students.find_one({'email': data['email']}):
        return jsonify({'status': 'error', 'message': 'Email already registered'})
    hashed_pw = generate_password_hash(data['password'])
    students.insert_one({
        'name': data['name'],
        'email': data['email'],
        'password': hashed_pw
    })
    return jsonify({'status': 'success'})

# === Student Login === #
@app.route('/student-login', methods=['POST'])
def student_login():
    data = request.json
    student = students.find_one({'email': data['email']})
    if student and check_password_hash(student['password'], data['password']):
        return jsonify({'user': {'username': student['name'], 'email': student['email'], 'type': 'student'}})
    return jsonify({'error': 'Invalid email or password'})

# === Teacher Login === #
@app.route('/teacher-login', methods=['POST'])
def teacher_login():
    data = request.json
    if data['teacherId'] == TEACHER_ID and data['password'] == TEACHER_PASSWORD:
        return jsonify({'user': {'id': TEACHER_ID, 'type': 'teacher'}})
    return jsonify({'error': 'Invalid Teacher ID or password'})

# === Conversation Memory === #

memory_store = {} 
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain_core.messages import HumanMessage, AIMessage

# In-memory store for user-specific memory (temporary)
memory_store = {}

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_input = data.get("message", "")
    user_email = data.get("email", "")

    # Create or reuse memory for this user
    if user_email not in memory_store:
        memory_store[user_email] = ConversationBufferMemory(return_messages=True)
    
    memory = memory_store[user_email]

    # Retrieve relevant documents from Pinecone (contextual memory)
    docs = retriever.invoke(user_input)
    docs_text = "\n".join([doc.page_content[:300] for doc in docs]) if docs else ""

    # Format prompt with context and recent memory
    memory_text = "\n".join([
        f"User: {msg.content}" if isinstance(msg, HumanMessage) else f"AI: {msg.content}"
        for msg in memory.chat_memory.messages
    ])

    system_prompt = f"""
    You are MindMate, a kind and thoughtful emotional support AI.

    Ignore unrelated stories or instructions.

    Context (if relevant):
    {docs_text}

    Recent memory:
    {memory_text}

    User: {user_input}
    """

    messages = [{"role": "system", "content": system_prompt}]
    response = llm.invoke(messages).content

    # Save interaction in LangChain memory
    memory.chat_memory.add_user_message(user_input)
    memory.chat_memory.add_ai_message(response)

    #Optionally persist in Pinecone
    vector_store.add_texts(
        texts=[f"User: {user_input}\nAI: {response}"],
        metadatas=[{"email": user_email}]
    )

    return jsonify({"response": response})

@app.route('/history', methods=['GET'])
def get_history():
    user_email = request.args.get("email", "")
    if not user_email:
        return jsonify({"error": "Missing email"}), 400

    results = vector_store.similarity_search(
        query="MindMate conversation history",
        k=50,
        filter={"email": user_email}
    )

    history = []
    for doc in results:
        lines = doc.page_content.strip().splitlines()
        user_msg = next((line.replace("User:", "").strip() for line in lines if line.startswith("User:")), None)
        ai_msg = next((line.replace("AI:", "").strip() for line in lines if line.startswith("AI:")), None)
        if user_msg and ai_msg:
            history.append({"user": user_msg, "bot": ai_msg})

    
    return jsonify({"history": history})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
