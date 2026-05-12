import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',          # XAMPP default — change if you set a password
    'database': 'investbridge',
    'port': 3306
}

ADMIN_EMAIL    = 'admin@investbridge.com'
ADMIN_PASSWORD = 'Admin@123'
ADMIN_FIRST    = 'Platform'
ADMIN_LAST     = 'Admin'

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

def init_db():
    """Create database, tables, and seed admin if not exists."""
    # Connect without DB to create it first
    cfg = {k: v for k, v in DB_CONFIG.items() if k != 'database'}
    conn = mysql.connector.connect(**cfg)
    cur = conn.cursor()
    cur.execute("CREATE DATABASE IF NOT EXISTS investbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cur.close(); conn.close()

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            first_name  VARCHAR(80)  NOT NULL,
            last_name   VARCHAR(80)  NOT NULL,
            email       VARCHAR(150) NOT NULL UNIQUE,
            password    VARCHAR(255) NOT NULL,
            role        ENUM('admin','startup','investor') NOT NULL,
            phone       VARCHAR(30),
            is_active   TINYINT(1) DEFAULT 1,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS startup_profiles (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            user_id        INT NOT NULL UNIQUE,
            company_name   VARCHAR(150),
            industry       VARCHAR(100),
            funding_stage  VARCHAR(50),
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS investor_profiles (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            user_id          INT NOT NULL UNIQUE,
            firm_name        VARCHAR(150),
            investor_type    VARCHAR(80),
            investment_focus VARCHAR(80),
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS proposals (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            user_id       INT NOT NULL,
            title         VARCHAR(200) NOT NULL,
            description   TEXT,
            industry      VARCHAR(100),
            funding_goal  DECIMAL(15,2),
            funding_stage VARCHAR(50),
            status        ENUM('draft','active','funded','closed') DEFAULT 'active',
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS interests (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            proposal_id INT NOT NULL,
            investor_id INT NOT NULL,
            status      ENUM('pending','accepted','rejected') DEFAULT 'pending',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_interest (proposal_id, investor_id),
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
            FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            user_id     INT NOT NULL,
            title       VARCHAR(200) NOT NULL,
            message     TEXT NOT NULL,
            type        ENUM('success','info','warning','error') DEFAULT 'info',
            is_read     TINYINT(1) DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            user_id     INT NOT NULL,
            title       VARCHAR(200) NOT NULL,
            message     TEXT NOT NULL,
            type        VARCHAR(20) DEFAULT 'info',
            is_read     TINYINT(1) DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            sender_id   INT NOT NULL,
            receiver_id INT NOT NULL,
            proposal_id INT NOT NULL,
            message     TEXT NOT NULL,
            is_read     TINYINT(1) DEFAULT 0,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS meetings (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            proposal_id  INT NOT NULL,
            startup_id   INT NOT NULL,
            investor_id  INT NOT NULL,
            title        VARCHAR(200) NOT NULL,
            meeting_date DATE NOT NULL,
            meeting_time TIME NOT NULL,
            meeting_type ENUM('Video Call','Phone Call','In Person') DEFAULT 'Video Call',
            agenda       TEXT,
            status       ENUM('pending','confirmed','declined','cancelled') DEFAULT 'pending',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
            FOREIGN KEY (startup_id)  REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    """)

    conn.commit()

    # Seed admin account
    cur.execute("SELECT id FROM users WHERE email = %s", (ADMIN_EMAIL,))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users (first_name, last_name, email, password, role) VALUES (%s,%s,%s,%s,'admin')",
            (ADMIN_FIRST, ADMIN_LAST, ADMIN_EMAIL, generate_password_hash(ADMIN_PASSWORD))
        )
        conn.commit()
        print(f"✅ Admin seeded → {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    else:
        print(f"ℹ️  Admin already exists: {ADMIN_EMAIL}")

    cur.close(); conn.close()
    print("✅ Database initialised.")
