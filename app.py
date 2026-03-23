from flask import Flask, jsonify, request
from flask_cors import CORS
import os

from models.db import init_db
from flask import send_from_directory
from routes.auth import auth_bp
from routes.customer import customer_bp
from routes.seller import seller_bp
import time

app = Flask(__name__)
# Enable production CORS for Vercel
# Robust CORS for all Vercel subdomains and local development
CORS(app, resources={r"/api/*": {
    "origins": [
        "https://project-spdvs.vercel.app",
        "https://festmarket-vibe.vercel.app",
        r"https://.*\.vercel\.app$",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# Ensure upload directory exists
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize DB on start
init_db()

RATE_LIMITS = {}
SUSPENSIONS = {}

def check_rate_limit(key, limit, window):
    now = time.time()
    if key not in RATE_LIMITS:
        RATE_LIMITS[key] = {"count": 1, "window_start": now}
        return True
    
    window_start = RATE_LIMITS[key]["window_start"]
    if now - window_start > window:
        RATE_LIMITS[key] = {"count": 1, "window_start": now}
        return True
    
    RATE_LIMITS[key]["count"] += 1
    if RATE_LIMITS[key]["count"] > limit:
        return False
    return True

@app.before_request
def anti_abuse():
    # Skip rate limiting for preflight CORS checks
    if request.method == 'OPTIONS':
        return
    
    ip = request.remote_addr
    now = time.time()
    
    # Check suspension cooldown
    if ip in SUSPENSIONS and now < SUSPENSIONS[ip]:
        return jsonify({"error": "Temporarily blocked due to suspicious activity. Try again later."}), 403
    elif ip in SUSPENSIONS:
        SUSPENSIONS.pop(ip, None)
        
    # Global IP Rate Limit: 30 per min
    if not check_rate_limit(f"ip:{ip}", limit=30, window=60):
        # Cooldown for 5 minutes
        SUSPENSIONS[ip] = now + 300
        try:
            from models.db import log_audit
            log_audit('ABUSE_DETECTED', None, "Rapid API calls exceeded. IP Blocked for 5 mins.", ip)
        except Exception:
            pass
        return jsonify({"error": "Rate limit exceeded. Try again in 5 minutes."}), 429


app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(customer_bp, url_prefix='/api/customer')
app.register_blueprint(seller_bp, url_prefix='/api/seller')

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify(error="API Route Not Found"), 404
    return send_from_directory('frontend', path)

@app.route('/')
def home():
    return send_from_directory('frontend', 'index.html')

# Basic Error handlers
@app.errorhandler(400)
def bad_request(e):
    return jsonify(error=str(e)), 400

@app.errorhandler(401)
def unauthorized(e):
    return jsonify(error=str(e)), 401

@app.errorhandler(403)
def forbidden(e):
    return jsonify(error=str(e)), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify(error="Not Found"), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify(error="Internal Server Error"), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
