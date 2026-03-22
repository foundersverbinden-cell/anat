from flask import Blueprint, request, current_app, jsonify
from models.db import get_db, log_audit
from utils.auth import token_required
from utils.upload import save_upload
import datetime

seller_bp = Blueprint('seller', __name__, url_prefix='/seller')

@seller_bp.route('/product', methods=['POST'])
@token_required(allowed_roles=['seller'])
def add_product(current_user):
    name = request.form.get('name')
    price = request.form.get('price')
    upi_id = request.form.get('upi_id')
    
    if not all([name, price, upi_id]) or 'image' not in request.files:
        return jsonify({'error': 'Missing fields or image'}), 400
        
    file = request.files['image']
    filename = save_upload(file, current_app.config['UPLOAD_FOLDER'])
    if not filename:
        return jsonify({'error': 'Invalid file. Must be image under 2MB'}), 400
        
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO products (seller_id, name, price, image, upi_id) VALUES (?, ?, ?, ?, ?)",
        (current_user['id'], name, float(price), filename, upi_id)
    )
    product_id = c.lastrowid
    conn.commit()
    log_audit('PRODUCT_ADDED', current_user['id'], f"Added product {product_id}", request.remote_addr)
    conn.close()
    
    return jsonify({'message': 'Product added successfully'}), 201

@seller_bp.route('/orders', methods=['GET'])
@token_required(allowed_roles=['seller'])
def get_orders(current_user):
    conn = get_db()
    c = conn.cursor()
    
    # Run 30m timeout check for NEEDS_ATTENTION
    c.execute('''
        SELECT o.id, o.status, o.created_at 
        FROM orders o JOIN products p ON o.product_id = p.id 
        WHERE p.seller_id = ?
    ''', (current_user['id'],))
    db_orders = c.fetchall()
    now = datetime.datetime.utcnow()
    for o in db_orders:
        if o['status'] == 'PAYMENT_UPLOADED':
            order_time = datetime.datetime.strptime(o['created_at'], '%Y-%m-%d %H:%M:%S')
            if (now - order_time).total_seconds() > 30 * 60:
                c.execute("UPDATE orders SET status = 'NEEDS_ATTENTION' WHERE id = ?", (o['id'],))
                log_audit('ORDER_FLAGGED', current_user['id'], f"Order {o['id']} flagged for attention")
    conn.commit()

    c.execute('''
        SELECT o.id, o.status, o.payment_proof, o.created_at, p.name, p.price, c.email as customer_email
        FROM orders o
        JOIN products p ON o.product_id = p.id
        JOIN users c ON o.customer_id = c.id
        WHERE p.seller_id = ?
        ORDER BY o.created_at DESC
    ''', (current_user['id'],))
    orders = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(orders), 200

@seller_bp.route('/verify', methods=['POST'])
@token_required(allowed_roles=['seller'])
def verify_payment(current_user):
    data = request.json
    order_id = data.get('order_id')
    action = data.get('action') # 'approve' or 'reject'
    
    if not order_id or action not in ('approve', 'reject'):
        return jsonify({'error': 'Invalid parameters'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    c.execute('''
        SELECT o.status 
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = ? AND p.seller_id = ?
    ''', (order_id, current_user['id']))
    order = c.fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found or unauthorized'}), 404
        
    if order['status'] not in ('PAYMENT_UPLOADED', 'NEEDS_ATTENTION'):
        conn.close()
        return jsonify({'error': 'Invalid state transition. Order must have proof uploaded.'}), 400
        
    new_status = 'VERIFIED' if action == 'approve' else 'PAYMENT_PENDING'
    c.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()
    log_audit('ORDER_VERIFIED', current_user['id'], f"Order {order_id} {action}d -> {new_status}")
    conn.close()
    
    return jsonify({'message': f"Order payment {action}d. Status is now {new_status}"}), 200

@seller_bp.route('/deliver', methods=['POST'])
@token_required(allowed_roles=['seller'])
def deliver_order(current_user):
    data = request.json
    order_id = data.get('order_id')
    
    if not order_id:
        return jsonify({'error': 'Missing order_id'}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    c.execute('''
        SELECT o.status 
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = ? AND p.seller_id = ?
    ''', (order_id, current_user['id']))
    order = c.fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found or unauthorized'}), 404
        
    if order['status'] != 'VERIFIED':
        conn.close()
        return jsonify({'error': 'Invalid state transition. Order must be verified.'}), 400
        
    c.execute("UPDATE orders SET status = 'DELIVERED' WHERE id = ?", (order_id,))
    conn.commit()
    log_audit('ORDER_DELIVERED', current_user['id'], f"Order {order_id} delivered")
    conn.close()
    
    return jsonify({'message': 'Order marked as delivered'}), 200
