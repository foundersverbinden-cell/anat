from flask import Blueprint, request, jsonify
import bcrypt
from models.db import get_db, log_audit
from utils.auth import create_tokens, decode_token

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')

    if not all([email, password, role]):
        return jsonify({'error': 'Missing fields'}), 400
    
    if role not in ('customer', 'seller'):
        return jsonify({'error': 'Invalid role'}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", (email, hashed_pw, role))
        user_id = c.lastrowid
        conn.commit()
        log_audit('USER_SIGNUP', user_id, f"Signed up as {role}", request.remote_addr)
        return jsonify({'message': 'User created successfully'}), 201
    except conn.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 400
    finally:
        conn.close()

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    conn.close()

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        access_token, refresh_token = create_tokens(user['id'], user['role'])
        log_audit('USER_LOGIN', user['id'], "Successful login", request.remote_addr)
        return jsonify({
            'message': 'Login successful',
            'token': access_token,
            'refresh_token': refresh_token,
            'role': user['role']
        }), 200
    else:
        user_id = user['id'] if user else None
        log_audit('FAILED_LOGIN', user_id, f"Failed login for email {email}", request.remote_addr)
        return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    data = request.json
    refresh_token = data.get('refresh_token')
    if not refresh_token:
         return jsonify({'error': 'Refresh token missing'}), 401
         
    token_data, error_msg = decode_token(refresh_token, 'refresh')
    if error_msg:
         return jsonify({'error': error_msg}), 401
         
    access_token, new_refresh = create_tokens(token_data['user_id'], token_data['role'])
    return jsonify({
         'token': access_token,
         'refresh_token': new_refresh
    }), 200
