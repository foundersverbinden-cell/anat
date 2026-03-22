import jwt
from functools import wraps
from flask import request, jsonify
import datetime

SECRET_KEY = "FESTIVAL_MARKETPLACE_SECRET_VERY_SECURE"

def create_tokens(user_id, role):
    access_payload = {
        'user_id': user_id,
        'role': role,
        'type': 'access',
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    }
    refresh_payload = {
        'user_id': user_id,
        'role': role,
        'type': 'refresh',
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    access_token = jwt.encode(access_payload, SECRET_KEY, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm='HS256')
    return access_token, refresh_token

def decode_token(token, expected_type='access'):
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        if data.get('type') != expected_type:
            return None, 'Invalid token type'
        return data, None
    except jwt.ExpiredSignatureError:
        return None, f'{expected_type.capitalize()} token has expired!'
    except jwt.InvalidTokenError:
        return None, 'Invalid token!'

def token_required(allowed_roles=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = None
            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(" ")[1]
            
            if not token:
                return jsonify({'error': 'Token is missing!'}), 401
            
            data, error_msg = decode_token(token, 'access')
            if error_msg:
                return jsonify({'error': error_msg}), 401
                
            current_user = {
                'id': data['user_id'],
                'role': data['role']
            }
            if allowed_roles and current_user['role'] not in allowed_roles:
                return jsonify({'error': 'Unauthorized role!'}), 403
                
            return f(current_user, *args, **kwargs)
        return decorated
    return decorator
