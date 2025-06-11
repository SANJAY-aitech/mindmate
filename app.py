from flask import Flask
from flask_cors import CORS
from auth.routes import auth_bp  # Import routes from auth module

app = Flask(__name__)
CORS(app)  # Allow frontend requests (from JS)

# Register Blueprints
app.register_blueprint(auth_bp)

@app.route("/")
def index():
    return "🚀 MindMate API is running"

if __name__ == "__main__":
    app.run(debug=True)
