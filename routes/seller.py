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
    description = request.form.get('description', '')
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
        "INSERT INTO products (seller_id, name, description, price, image, upi_id) VALUES (?, ?, ?, ?, ?, ?)",
        (current_user['id'], name, description, float(price), filename, upi_id)
    )
    product_id = c.lastrowid
    conn.commit()
    log_audit('PRODUCT_ADDED', current_user['id'], f"Added product {product_id}", request.remote_addr)
    conn.close()
    
    return jsonify({'message': 'Product added successfully'}), 201

@seller_bp.route('/products', methods=['GET'])
@token_required(allowed_roles=['seller'])
def get_products(current_user):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC", (current_user['id'],))
    products = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(products), 200

@seller_bp.route('/product/<int:product_id>', methods=['DELETE'])
@token_required(allowed_roles=['seller'])
def delete_product(current_user, product_id):
    conn = get_db()
    c = conn.cursor()
    
    # Check ownership
    c.execute("SELECT id FROM products WHERE id = ? AND seller_id = ?", (product_id, current_user['id']))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Product not found or unauthorized'}), 404
        
    c.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    log_audit('PRODUCT_DELETED', current_user['id'], f"Deleted product {product_id}")
    conn.close()
    return jsonify({'message': 'Product deleted successfully'}), 200

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
    reason = data.get('reason', '') # Rejection reason
    
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
        
    if order['status'] not in ('PAYMENT_UPLOADED', 'NEEDS_ATTENTION', 'REJECTED'):
        conn.close()
        return jsonify({'error': 'Invalid state transition.'}), 400
        
    if action == 'approve':
        new_status = 'VERIFIED'
        rejection_reason = None
    else:
        new_status = 'REJECTED'
        rejection_reason = reason if reason else 'Payment not verified'

    c.execute(
        "UPDATE orders SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_status, rejection_reason, order_id)
    )
    conn.commit()
    log_audit('ORDER_VERIFIED', current_user['id'], f"Order {order_id} {action}d -> {new_status}")
    conn.close()
    
    return jsonify({'message': f"Order payment {action}d. Status is now {new_status}", 'status': new_status}), 200

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
        
    c.execute("UPDATE orders SET status = 'DELIVERED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (order_id,))
    conn.commit()
    log_audit('ORDER_DELIVERED', current_user['id'], f"Order {order_id} delivered")
    conn.close()
    
    return jsonify({'message': 'Order marked as delivered'}), 200

@seller_bp.route('/dashboard', methods=['GET'])
@token_required(allowed_roles=['seller'])
def get_dashboard(current_user):
    conn = get_db()
    c = conn.cursor()
    
    # 1. Total Revenue (sum of price for VERIFIED or DELIVERED)
    c.execute('''
        SELECT SUM(p.price) as revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.seller_id = ? AND o.status IN ('VERIFIED', 'DELIVERED')
    ''', (current_user['id'],))
    revenue = c.fetchone()['revenue'] or 0
    
    # 2. Total Orders (count)
    c.execute('''
        SELECT COUNT(o.id) as count
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.seller_id = ?
    ''', (current_user['id'],))
    orders_count = c.fetchone()['count'] or 0
    
    # 3. Total Views (sum of products.views)
    c.execute('SELECT SUM(views) as views FROM products WHERE seller_id = ?', (current_user['id'],))
    views = c.fetchone()['views'] or 0
    
    # 4. Products
    c.execute('SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC', (current_user['id'],))
    products = [dict(row) for row in c.fetchall()]
    
    # 5. Orders (Enhanced for UPI Trust System)
    c.execute('''
        SELECT o.id, o.status, o.payment_proof, o.utr_id, o.rejection_reason, o.created_at, o.updated_at,
               p.name as product_name, p.price, u.email as customer_email
        FROM orders o
        JOIN products p ON o.product_id = p.id
        JOIN users u ON o.customer_id = u.id
        WHERE p.seller_id = ?
        ORDER BY o.created_at DESC
    ''', (current_user['id'],))
    orders = [dict(row) for row in c.fetchall()]
    
    conn.close()
    return jsonify({
        'revenue': revenue,
        'orders_count': orders_count,
        'views': views,
        'products': products,
        'orders': orders
    }), 200
