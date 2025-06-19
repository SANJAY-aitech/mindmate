from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import json
import io

# LangChain + Ollama + Pinecone
from langchain_ollama import ChatOllama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone
from langchain.schema.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# New LangChain memory system
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain.memory.chat_message_histories.in_memory import ChatMessageHistory

# HuggingFace Transformers for emotion detection
from transformers import pipeline

load_dotenv()
app = Flask(__name__)
CORS(app)

# === MongoDB Setup === #
client = MongoClient(os.getenv("MONGO_URI"))
db = client["mindmate"]
students = db["students"]
journals = db["journals"]
chat_logs = db["chat_logs"]  # For per-message emotion and text logging

# === Teacher Credentials === #
TEACHER_ID = "teacher123"
TEACHER_PASSWORD = "password123"

# === Pinecone + LangChain Setup === #
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
vector_store = PineconeVectorStore(index=index, embedding=embeddings)
retriever = vector_store.as_retriever(search_type="similarity_score_threshold", search_kwargs={"k": 3, "score_threshold": 0.5})

llm = ChatOllama(model="gemma3:1b", temperature=0, max_tokens=50)

# Emotion classification pipeline
emotion_classifier = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=1)

def detect_emotion(text):
    try:
        result = emotion_classifier(text)[0][0]  
        return result['label']
    except Exception as e:
        print(f"Emotion detection failed: {e}")
        return "unknown"

# === Prompt Template === #
prompt_template = ChatPromptTemplate.from_messages([
    ("system", """
You are MindMate, a calm, empathetic, and supportive emotional wellness AI designed to assist students experiencing academic, personal, or emotional stress.

Your mission:
- Act as a private, judgment-free listener and reflection partner.
- Help students express their feelings openly and safely.
- Guide students in understanding and managing stress, anxiety, and emotional challenges.
- Encourage self-awareness, resilience, and mindfulness practices.
- Offer actionable suggestions only if included in the retrieved context below.
- Respect privacy and never escalate concerns unless the user explicitly consents.
- Avoid clinical diagnoses, assumptions, or invented facts.
- Vary your tone and responses; be genuinely present in each interaction.

Always speak with:
- Warmth, understanding, and patience.
- Non-judgmental and non-intrusive language.
- A focus on listening over fixing.
     
Based on your recent emotions, you’ve been feeling: {past_feelings}. Feel free to continue sharing anything on your mind.
--- Retrieved suggestions, reflections, or resources (if any) ---
{context}

--- Recent emotional and conversational memory ---
{memory}
    """),
    MessagesPlaceholder(variable_name="messages"),
    ("human", "{user_input}")
])

user_histories = {}

def get_user_history(session_id: str):
    if session_id not in user_histories:
        user_histories[session_id] = ChatMessageHistory()
    return user_histories[session_id]

@app.route('/')
def index():
    return render_template('index.html')

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

@app.route('/student-login', methods=['POST'])
def student_login():
    data = request.json
    student = students.find_one({'email': data['email']})
    if student and check_password_hash(student['password'], data['password']):
        return jsonify({'user': {'username': student['name'], 'email': student['email'], 'type': 'student'}})
    return jsonify({'error': 'Invalid email or password'})

@app.route('/teacher-login', methods=['POST'])
def teacher_login():
    data = request.json
    if data['teacherId'] == TEACHER_ID and data['password'] == TEACHER_PASSWORD:
        return jsonify({'user': {'id': TEACHER_ID, 'type': 'teacher'}})
    return jsonify({'error': 'Invalid Teacher ID or password'})

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_input = data.get("message", "")
    user_email = data.get("email", "")

    if not user_email:
        return jsonify({"error": "Missing email"}), 400

    docs = retriever.invoke(user_input)
    docs_text = "\n".join([doc.page_content[:300] for doc in docs]) if docs else ""

    history = get_user_history(user_email)
    memory_text = "\n".join([
        f"User: {msg.content}" if isinstance(msg, HumanMessage) else f"AI: {msg.content}"
        for msg in history.messages
    ])

    recent_logs = list(chat_logs.find({"email": user_email}).sort("timestamp", -1).limit(3))
    past_emotions = [log.get("emotion") for log in recent_logs if log.get("emotion") != "unknown"]
    past_feelings = ", ".join(past_emotions[::-1]) if past_emotions else "neutral"

    inputs = {
        "context": docs_text,
        "memory": memory_text,
        "messages": history.messages,
        "user_input": user_input,
        "past_feelings": past_feelings
    }

    chain = (prompt_template | llm | StrOutputParser())
    runnable = RunnableWithMessageHistory(
        chain,
        get_user_history,
        input_messages_key="user_input",
        history_messages_key="messages"
    )

    response = runnable.invoke(inputs, config={"configurable": {"session_id": user_email}})

    emotion = detect_emotion(user_input)
    
    timestamp = datetime.utcnow()

    chat_logs.insert_one({
        "email": user_email,
        "message": user_input,
        "response": response,
        "emotion": emotion,
        "timestamp": timestamp
    })

#     # vector_store.add_texts(
#     # texts=[f"User: {user_input}\nAI: {response}"],
#     # metadatas=[{
#     #     "email": user_email,
#     #     "emotion": emotion,
#     #     "timestamp": datetime.utcnow().isoformat()
#     # }]
# )


    return jsonify({"response": response})

@app.route('/history', methods=['GET'])
def get_history():
    user_email = request.args.get("email", "")
    if not user_email:
        return jsonify({"error": "Missing email"}), 400

    results = vector_store.similarity_search_with_score(
        "chat",  # dummy query
        k=100,
        filter={"email": user_email}
    )

    # Sort by timestamp
    sorted_results = sorted(
        results, 
        key=lambda x: x[0].metadata.get("timestamp", "")
    )

    history = []
    for doc, _ in sorted_results:
        text = doc.page_content
        if "User:" in text and "AI:" in text:
            parts = text.split("AI:")
            user_msg = parts[0].replace("User:", "").strip()
            bot_msg = parts[1].strip()
            history.append({"user": user_msg, "bot": bot_msg})

    return jsonify(history)


@app.route('/download-journal', methods=['GET'])
def download_journal():
    email = request.args.get("email", "")
    if not email:
        return jsonify({"error": "Missing email"}), 400

    entries = list(chat_logs.find({"email": email}).sort("timestamp", 1))
    if not entries:
        return jsonify({"error": "No journal entries found."}), 404

    content = "\n\n".join([
        f"Date: {entry['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}\nEmotion: {entry['emotion']}\nUser: {entry['message']}\nAI: {entry['response']}"
        for entry in entries
    ])

    buffer = io.BytesIO()
    buffer.write(content.encode('utf-8'))
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{email}_journal.txt",
        mimetype='text/plain'
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)