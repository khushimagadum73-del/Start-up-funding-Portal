"""
Run this ONCE to create the default admin account.
  python seed_admin.py
"""
from werkzeug.security import generate_password_hash
from db import get_connection, init_db

ADMIN_EMAIL    = 'admin@investbridge.com'
ADMIN_PASSWORD = 'Admin@123'
ADMIN_FIRST    = 'Platform'
ADMIN_LAST     = 'Admin'

def seed():
    init_db()
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (ADMIN_EMAIL,))
    if cur.fetchone():
        print(f"⚠️  Admin already exists: {ADMIN_EMAIL}")
    else:
        cur.execute(
            "INSERT INTO users (first_name, last_name, email, password, role) VALUES (%s,%s,%s,%s,'admin')",
            (ADMIN_FIRST, ADMIN_LAST, ADMIN_EMAIL, generate_password_hash(ADMIN_PASSWORD))
        )
        conn.commit()
        print(f"✅ Admin created → {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    cur.close(); conn.close()

if __name__ == '__main__':
    seed()
