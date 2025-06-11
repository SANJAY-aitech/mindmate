from flask import Blueprint, request, jsonify
from auth.models import add_student,validate_student

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"status": "error", "message": "All fields required"}), 400

    result = add_student(name, email, password)
    return jsonify(result), 201 if result["status"] == "success" else 409
@auth_bp.route('/student-login', methods=['POST'])
def student_login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = validate_student(email, password)
    if user:
        return jsonify({
            "message": "Login successful",
            "user": user
        }), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401
