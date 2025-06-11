import bcrypt
from datetime import datetime
from db import students

def add_student(name, email, password):
    # Check if student already exists
    if students.find_one({"email": email}):
        return {"status": "exists", "message": "Email already registered"}

    # Hash the password
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    # Insert into database
    students.insert_one({
        "name": name,
        "email": email,
        "password": hashed,
        "created_at": datetime.utcnow()
    })

    return {"status": "success", "message": "Student registered"}


def validate_student(email, password):
    user = students.find_one({"email": email})
    if user and bcrypt.checkpw(password.encode('utf-8'), user["password"]):
        return {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"]
        }
    return None