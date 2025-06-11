from flask import Flask,render_template
from flask_cors import CORS
from app.routes import auth_bp

app = Flask(__name__)
app.secret_key = "supersecretkey123"  # Set this!
CORS(app)

app.register_blueprint(auth_bp)

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
