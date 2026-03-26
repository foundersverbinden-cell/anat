from flask import Blueprint, request, current_app, jsonify
from models.db import get_db, log_audit
from utils.auth import token_required
from utils.upload import save_upload
import datetime
import time
import re

customer_bp = Blueprint('customer', __name__, url_prefix='/customer')

USER_ORDER_LIMITS = {}
def check_order_rate(user_id):
    now = time.time()
    if user_id not in USER_ORDER_LIMITS:
        USER_ORDER_LIMITS[user_id] = {"count": 1, "window": now}
        return True
    if now - USER_ORDER_LIMITS[user_id]["window"] > 60:
        USER_ORDER_LIMITS[user_id] = {"count": 1, "window": now}
        return True
    USER_ORDER_LIMITS[user_id]["count"] += 1
    return USER_ORDER_LIMITS[user_id]["count"] <= 5

@customer_bp.route('/products', methods=['GET'])
@token_required(allowed_roles=['customer'])
def get_products(current_user):
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT p.id, p.name, p.description, p.price, p.image, p.upi_id, u.email as seller_email, u.is_verified
        FROM products p 
        JOIN users u ON p.seller_id = u.id
    ''')
    products = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(products), 200

@customer_bp.route('/chat', methods=['POST'])
@token_required(allowed_roles=['customer'])
def ai_chat(current_user):
    data = request.json
    message = data.get('message', '').lower()
    
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT p.id, p.name, p.description, p.price, p.image, u.email as seller_email 
        FROM products p 
        JOIN users u ON p.seller_id = u.id
    ''')
    products = [dict(row) for row in c.fetchall()]
    conn.close()
    
    # Simple NLP Keyword Matching
    words = re.findall(r'\w+', message)
    stop_words = {'i', 'want', 'to', 'eat', 'some', 'looking', 'for', 'a', 'an', 'the', 'is', 'are', 'show', 'me'}
    keywords = [w for w in words if w not in stop_words]
    
    matches = []
    for p in products:
        score = 0
        # search in name and description
        text_to_search = f"{p['name']} {p['description']}".lower()
        for kw in keywords:
            if kw in text_to_search:
                score += 1
        if score > 0:
            matches.append((score, p))
            
    matches.sort(key=lambda x: x[0], reverse=True)
    
    if not matches:
        response_text = "I couldn't find exactly what you're looking for, but check out our catalog for other amazing vibes!"
        return jsonify({'response': response_text, 'products': []}), 200
        
    top_matches = [m[1] for m in matches[:3]]
    product_names = ", ".join([f"{p['name']} (₹{p['price']})" for p in top_matches])
    response_text = f"Based on your request, I found these great options: {product_names}. Take a look below!"
    
    return jsonify({'response': response_text, 'products': top_matches}), 200

@customer_bp.route('/order', methods=['POST'])
@token_required(allowed_roles=['customer'])
def create_order(current_user):
    if not check_order_rate(current_user['id']):
        log_audit('RATE_LIMIT', current_user['id'], "Order creation limit exceeded", request.remote_addr)
        return jsonify({'error': 'Order limit exceeded. Max 5 per minute.'}), 429

    data = request.json
    product_id = data.get('product_id')
    
    if not product_id:
        return jsonify({'error': 'Product ID required'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT id FROM products WHERE id = ?", (product_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    c.execute(
        "INSERT INTO orders (product_id, customer_id, status) VALUES (?, ?, 'PAYMENT_PENDING')",
        (product_id, current_user['id'])
    )
    order_id = c.lastrowid
    conn.commit()
    log_audit('ORDER_CREATED', current_user['id'], f"Created order {order_id} for product {product_id}", request.remote_addr)
    conn.close()
    
    return jsonify({'message': 'Order created, pending payment', 'order_id': order_id}), 201

@customer_bp.route('/payment-proof', methods=['POST'])
@token_required(allowed_roles=['customer'])
def upload_proof(current_user):
    order_id = request.form.get('order_id')
    utr_id = request.form.get('utr_id')
    
    if 'proof' not in request.files or not order_id or not utr_id:
        return jsonify({'error': 'Missing file, UTR ID, or order ID'}), 400
        
    # UTR ID Validation (basic 12-digit check for UPI)
    if not re.match(r'^\d{12}$', utr_id):
         return jsonify({'error': 'Invalid UTR ID. Must be 12 digits.'}), 400

    file = request.files['proof']
    filename = save_upload(file, current_app.config['UPLOAD_FOLDER'])
    if not filename:
        return jsonify({'error': 'Invalid file. Must be image under 2MB'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    # Check for Duplicate UTR
    c.execute("SELECT id FROM orders WHERE utr_id = ? AND status != 'CANCELLED'", (utr_id,))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Duplicate UTR ID. This payment has already been submitted.'}), 409

    c.execute("SELECT status FROM orders WHERE id = ? AND customer_id = ?", (order_id, current_user['id']))
    order = c.fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found or unauthorized'}), 404
        
    if order['status'] not in ['PAYMENT_PENDING', 'REJECTED']:
        conn.close()
        return jsonify({'error': 'Invalid state transition'}), 400

    c.execute(
        "UPDATE orders SET status = 'PAYMENT_UPLOADED', payment_proof = ?, utr_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (filename, utr_id, order_id)
    )
    conn.commit()
    log_audit('PAYMENT_UPLOADED', current_user['id'], f"Uploaded proof {utr_id} for order {order_id}", request.remote_addr)
    conn.close()
    
    return jsonify({'message': 'Payment proof submitted for verification', 'proof_image': filename, 'utr_id': utr_id}), 200

@customer_bp.route('/orders', methods=['GET'])
@token_required(allowed_roles=['customer'])
def get_orders(current_user):
    conn = get_db()
    c = conn.cursor()
    
    # Run 24h expiry check (Enhanced from 15m)
    c.execute("SELECT id, status, created_at FROM orders WHERE customer_id = ?", (current_user['id'],))
    db_orders = c.fetchall()
    now = datetime.datetime.utcnow()
    for o in db_orders:
        if o['status'] == 'PAYMENT_PENDING':
            order_time = datetime.datetime.strptime(o['created_at'], '%Y-%m-%d %H:%M:%S')
            # 24 Hour Expiry as per requirement 7
            if (now - order_time).total_seconds() > 24 * 60 * 60:
                c.execute("UPDATE orders SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (o['id'],))
                log_audit('ORDER_EXPIRED', current_user['id'], f"Order {o['id']} expired after 24h")
    conn.commit()

    c.execute('''
        SELECT o.id, o.status, o.utr_id, o.rejection_reason, p.name, p.price, p.upi_id, o.created_at, o.updated_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
    ''', (current_user['id'],))
    orders = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(orders), 200
@customer_bp.route('/view', methods=['POST'])
@token_required(allowed_roles=['customer'])
def increment_view(current_user):
    product_id = request.json.get('product_id')
    if not product_id:
        return jsonify({'error': 'Missing product_id'}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE products SET views = views + 1 WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'View recorded'}), 200

@customer_bp.route('/recently-purchased', methods=['GET'])
@token_required(allowed_roles=['customer'])
def recently_purchased(current_user):
    conn = get_db()
    c = conn.cursor()
    # Get last 5 verified orders
    c.execute('''
        SELECT p.name, o.updated_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status IN ('VERIFIED', 'DELIVERED')
        ORDER BY o.updated_at DESC
        LIMIT 5
    ''')
    feed = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(feed), 200
@customer_bp.route('/recommend', methods=['GET'])
@token_required(allowed_roles=['customer'])
def recommend_products(current_user):
    category = request.args.get('category')
    max_price = request.args.get('max_price')
    keyword = request.args.get('keyword')
    
    conn = get_db()
    c = conn.cursor()
    
    query = "SELECT p.*, u.email as seller_email, u.is_verified FROM products p JOIN users u ON p.seller_id = u.id WHERE 1=1"
    params = []
    
    if max_price:
        try:
            query += " AND p.price <= ?"
            params.append(float(max_price))
        except ValueError:
            pass
        
    # Standard Vibe Keywords mapping (Sync with frontend chips)
    vibe_map = {
        'healthy': ['healthy', 'organic', 'fresh', 'vegan', 'green', 'clean', 'natural'],
        'budget': ['budget', 'cheap', 'affordable', 'low price', 'deal'],
        'fast': ['fast', 'quick', 'instant', 'speedy', 'express'],
        'premium': ['premium', 'luxury', 'exclusive', 'high-end', 'elite']
    }
    
    search_terms = []
    if category and category.lower() in vibe_map:
        search_terms.extend(vibe_map[category.lower()])
    if keyword:
        search_terms.append(keyword.lower())
        
    if search_terms:
        # Build a complex LIKE clause for any of the terms matching (OR logic within terms)
        like_clauses = []
        for term in search_terms:
            like_clauses.append("(p.name LIKE ? OR p.description LIKE ?)")
            params.append(f"%{term}%")
            params.append(f"%{term}%")
        query += " AND (" + " OR ".join(like_clauses) + ")"
        
    # Sort by views (popularity)
    query += " ORDER BY p.views DESC"
    
    c.execute(query, params)
    products = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify(products), 200
