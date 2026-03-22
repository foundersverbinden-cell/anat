import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'marketplace.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('PRAGMA foreign_keys = OFF;')

    # Migrate orders table if it exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='orders';")
    if c.fetchone():
        c.execute("DROP TABLE IF EXISTS orders_old;")
        c.execute("ALTER TABLE orders RENAME TO orders_old;")

    # 1. users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('customer', 'seller')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 2. products table
    c.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            image TEXT NOT NULL,
            upi_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    # 3. orders table with NEW schema
    c.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('CREATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'VERIFIED', 'DELIVERED', 'CANCELLED', 'NEEDS_ATTENTION')),
            payment_proof TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY(customer_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Copy old data if migrating
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='orders_old';")
    if c.fetchone():
        try:
            c.execute("INSERT INTO orders SELECT * FROM orders_old;")
        except Exception:
            pass # ignore errors on copy mapping to new schema restrictions
        c.execute("DROP TABLE IF EXISTS orders_old;")

    # 4. audit_logs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            user_id INTEGER,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    c.execute('PRAGMA foreign_keys = ON;')
    conn.commit()
    conn.close()

def log_audit(action, user_id=None, details=None, ip_address=None):
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        INSERT INTO audit_logs (action, user_id, details, ip_address) 
        VALUES (?, ?, ?, ?)
    ''', (action, user_id, details, ip_address))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
