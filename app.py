from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_connection, init_db
import re, secrets

app = Flask(__name__)

CORS(app, origins='*', allow_headers=['Content-Type', 'X-Auth-Token'])

# In-memory token store: { token: { user_id, role } }
# Fine for local/dev â€” swap for Redis or DB tokens in production
_tokens = {}

@app.before_request
def handle_options():
    from flask import request as req, make_response
    if req.method == 'OPTIONS':
        resp = make_response('', 204)
        resp.headers['Access-Control-Allow-Origin']  = '*'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Auth-Token'
        resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return resp

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Auth-Token'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response


# â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def valid_email(email):
    return re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email)

def user_to_dict(row, keys):
    return dict(zip(keys, row))

def get_current_user():
    token = request.headers.get('X-Auth-Token')
    if not token:
        return None
    return _tokens.get(token)

# â”€â”€ auth routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/register', methods=['POST'])
def register():
    data       = request.get_json()
    first_name = (data.get('first_name') or '').strip()
    last_name  = (data.get('last_name')  or '').strip()
    email      = (data.get('email')      or '').strip().lower()
    password   = data.get('password', '')
    role       = data.get('role', '')
    phone      = (data.get('phone') or '').strip()

    if not all([first_name, last_name, email, password, role]):
        return jsonify({'error': 'All required fields must be filled.'}), 400
    if role not in ('startup', 'investor'):
        return jsonify({'error': 'Invalid role. Only startup or investor can self-register.'}), 400
    if not valid_email(email):
        return jsonify({'error': 'Invalid email address.'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters.'}), 400

    hashed = generate_password_hash(password)
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return jsonify({'error': 'An account with this email already exists.'}), 409

        cur.execute(
            "INSERT INTO users (first_name, last_name, email, password, role, phone) VALUES (%s,%s,%s,%s,%s,%s)",
            (first_name, last_name, email, hashed, role, phone)
        )
        user_id = cur.lastrowid

        if role == 'startup':
            cur.execute(
                "INSERT INTO startup_profiles (user_id, company_name, industry, funding_stage) VALUES (%s,%s,%s,%s)",
                (user_id, data.get('company_name',''), data.get('industry',''), data.get('funding_stage',''))
            )
        elif role == 'investor':
            cur.execute(
                "INSERT INTO investor_profiles (user_id, firm_name, investor_type, investment_focus) VALUES (%s,%s,%s,%s)",
                (user_id, data.get('firm_name',''), data.get('investor_type',''), data.get('investment_focus',''))
            )

        conn.commit()
        return jsonify({'message': 'Account created successfully.', 'user_id': user_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


@app.route('/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = (data.get('email')    or '').strip().lower()
    password = data.get('password', '')
    role     = data.get('role', '')

    if not all([email, password, role]):
        return jsonify({'error': 'Email, password and role are required.'}), 400

    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute(
            "SELECT id, first_name, last_name, password, role, is_active FROM users WHERE email = %s",
            (email,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'No account found with this email.'}), 401

        uid, first, last, pw_hash, db_role, is_active = row

        if not check_password_hash(pw_hash, password):
            return jsonify({'error': 'Incorrect password.'}), 401
        if db_role != role:
            return jsonify({'error': f'This account is registered as "{db_role}", not "{role}".'}), 403
        if not is_active:
            return jsonify({'error': 'Your account has been deactivated. Contact support.'}), 403

        token = secrets.token_hex(32)
        _tokens[token] = {'user_id': uid, 'role': db_role}

        return jsonify({
            'message': 'Login successful.',
            'token': token,
            'name': f'{first} {last}',
            'role': db_role
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


@app.route('/logout', methods=['POST'])
def logout():
    token = request.headers.get('X-Auth-Token')
    if token and token in _tokens:
        del _tokens[token]
    return jsonify({'message': 'Logged out.'}), 200


@app.route('/me', methods=['GET'])
def me():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT id, first_name, last_name, email, role FROM users WHERE id = %s", (user['user_id'],))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'User not found.'}), 404
        return jsonify(user_to_dict(row, ['id','first_name','last_name','email','role'])), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

# â”€â”€ admin routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/admin/stats', methods=['GET'])
def admin_stats():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Forbidden.'}), 403
    try:
        conn = get_connection()
        cur  = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE role='startup'")
        total_startups = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM users WHERE role='investor'")
        total_investors = cur.fetchone()[0]

        cur.execute("""
            SELECT first_name, last_name, email, role, created_at, is_active
            FROM users ORDER BY created_at DESC LIMIT 10
        """)
        cols = ['first_name','last_name','email','role','created_at','is_active']
        recent_users = [user_to_dict(r, cols) for r in cur.fetchall()]
        for u in recent_users:
            u['created_at'] = u['created_at'].isoformat() if u['created_at'] else None

        return jsonify({
            'total_users':    total_users,
            'total_startups': total_startups,
            'total_investors':total_investors,
            'total_deals':    0,
            'recent_users':   recent_users
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/admin/users', methods=['GET'])
def admin_users():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Forbidden.'}), 403
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("SELECT first_name, last_name, email, role, created_at, is_active FROM users ORDER BY created_at DESC")
        cols = ['first_name','last_name','email','role','created_at','is_active']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


@app.route('/admin/startups', methods=['GET'])
def admin_startups():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Forbidden.'}), 403
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.first_name, u.last_name, u.email, u.created_at,
                   sp.company_name, sp.industry, sp.funding_stage
            FROM users u
            JOIN startup_profiles sp ON sp.user_id = u.id
            ORDER BY u.created_at DESC
        """)
        cols = ['first_name','last_name','email','created_at','company_name','industry','funding_stage']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


@app.route('/admin/investors', methods=['GET'])
def admin_investors():
    user = get_current_user()
    if not user or user['role'] != 'admin':
        return jsonify({'error': 'Forbidden.'}), 403
    try:
        conn = get_connection()
        cur  = conn.cursor()
        cur.execute("""
            SELECT u.first_name, u.last_name, u.email, u.created_at,
                   ip.firm_name, ip.investor_type, ip.investment_focus
            FROM users u
            JOIN investor_profiles ip ON ip.user_id = u.id
            ORDER BY u.created_at DESC
        """)
        cols = ['first_name','last_name','email','created_at','firm_name','investor_type','investment_focus']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()


# â”€â”€ startup proposal routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/proposals', methods=['GET'])
def get_proposals():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT id, title, description, industry, funding_goal, funding_stage, status, created_at
            FROM proposals WHERE user_id = %s ORDER BY created_at DESC
        """, (user['user_id'],))
        cols = ['id','title','description','industry','funding_goal','funding_stage','status','created_at']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at']   = r['created_at'].isoformat() if r['created_at'] else None
            r['funding_goal'] = float(r['funding_goal']) if r['funding_goal'] else 0
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/proposals', methods=['POST'])
def create_proposal():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    if user['role'] != 'startup': return jsonify({'error': 'Only startup accounts can create proposals.'}), 403
    data = request.get_json()
    title         = (data.get('title') or '').strip()
    description   = (data.get('description') or '').strip()
    industry      = (data.get('industry') or '').strip()
    funding_goal  = data.get('funding_goal', 0)
    funding_stage = (data.get('funding_stage') or '').strip()
    if not title: return jsonify({'error': 'Title is required.'}), 400
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO proposals (user_id, title, description, industry, funding_goal, funding_stage)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (user['user_id'], title, description, industry, funding_goal, funding_stage))
        conn.commit()
        return jsonify({'message': 'Proposal created.', 'id': cur.lastrowid}), 201
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/proposals/<int:pid>', methods=['DELETE'])
def delete_proposal(pid):
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("DELETE FROM proposals WHERE id=%s AND user_id=%s", (pid, user['user_id']))
        conn.commit()
        return jsonify({'message': 'Deleted.'}), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ investor: browse all active proposals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/proposals/all', methods=['GET'])
def all_proposals():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT p.id, p.title, p.description, p.industry, p.funding_goal,
                   p.funding_stage, p.status, p.created_at,
                   u.first_name, u.last_name,
                   COALESCE(sp.company_name,'') AS company_name,
                   (SELECT COUNT(*) FROM interests i WHERE i.proposal_id = p.id) AS interest_count,
                   (SELECT COUNT(*) FROM interests i WHERE i.proposal_id = p.id
                    AND i.investor_id = %s) AS already_interested
            FROM proposals p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN startup_profiles sp ON sp.user_id = p.user_id
            WHERE p.status = 'active'
            ORDER BY p.created_at DESC
        """, (user['user_id'],))
        cols = ['id','title','description','industry','funding_goal','funding_stage',
                'status','created_at','first_name','last_name','company_name',
                'interest_count','already_interested']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at']         = r['created_at'].isoformat() if r['created_at'] else None
            r['funding_goal']       = float(r['funding_goal']) if r['funding_goal'] else 0
            r['already_interested'] = bool(r['already_interested'])
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ investor: show interest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/proposals/<int:pid>/interest', methods=['POST'])
def show_interest(pid):
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    if user['role'] != 'investor': return jsonify({'error': 'Only investors can show interest.'}), 403
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("SELECT id FROM proposals WHERE id=%s AND status='active'", (pid,))
        if not cur.fetchone(): return jsonify({'error': 'Proposal not found.'}), 404
        cur.execute("INSERT IGNORE INTO interests (proposal_id, investor_id) VALUES (%s,%s)",
                    (pid, user['user_id']))
        conn.commit()
        return jsonify({'message': 'Interest registered.'}), 201
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ startup: get interested investors for a proposal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/proposals/<int:pid>/interests', methods=['GET'])
def get_interests(pid):
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("SELECT id FROM proposals WHERE id=%s AND user_id=%s", (pid, user['user_id']))
        if not cur.fetchone(): return jsonify({'error': 'Not found.'}), 404
        cur.execute("""
            SELECT i.id, i.status, i.created_at,
                   u.first_name, u.last_name, u.email,
                   COALESCE(ip.firm_name,'') AS firm_name,
                   COALESCE(ip.investor_type,'') AS investor_type
            FROM interests i
            JOIN users u ON u.id = i.investor_id
            LEFT JOIN investor_profiles ip ON ip.user_id = i.investor_id
            WHERE i.proposal_id = %s ORDER BY i.created_at DESC
        """, (pid,))
        cols = ['id','status','created_at','first_name','last_name','email','firm_name','investor_type']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ startup: accept an investor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/interests/<int:iid>/accept', methods=['POST'])
def accept_interest(iid):
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT i.id, i.investor_id, i.proposal_id, p.title
            FROM interests i JOIN proposals p ON p.id = i.proposal_id
            WHERE i.id=%s AND p.user_id=%s
        """, (iid, user['user_id']))
        row = cur.fetchone()
        if not row: return jsonify({'error': 'Not found.'}), 404
        _, investor_id, proposal_id, proposal_title = row

        # accept this one
        cur.execute("UPDATE interests SET status='accepted' WHERE id=%s", (iid,))

        # reject all other pending interests for same proposal and notify them
        cur.execute("""
            SELECT i.investor_id FROM interests i
            WHERE i.proposal_id=%s AND i.id!=%s AND i.status='pending'
        """, (proposal_id, iid))
        rejected_investors = [r[0] for r in cur.fetchall()]

        cur.execute("""
            UPDATE interests SET status='rejected'
            WHERE proposal_id=%s AND id!=%s AND status='pending'
        """, (proposal_id, iid))

        # mark proposal as funded
        cur.execute("UPDATE proposals SET status='funded' WHERE id=%s", (proposal_id,))

        # notify accepted investor
        cur.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s, %s, %s, 'success')
        """, (investor_id,
              'Investment Approved! ðŸŽ‰',
              f'Your interest in "{proposal_title}" has been accepted by the startup. Congratulations! They will be in touch soon.'))

        # notify rejected investors
        for rid in rejected_investors:
            cur.execute("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (%s, %s, %s, 'info')
            """, (rid,
                  'Investment Update',
                  f'The startup has selected another investor for "{proposal_title}". Thank you for your interest â€” keep exploring other opportunities!'))

        conn.commit()
        return jsonify({'message': 'Investor accepted.', 'proposal_title': proposal_title}), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ investor: get my notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/my/notifications', methods=['GET'])
def my_notifications():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT id, title, message, type, is_read, created_at
            FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 50
        """, (user['user_id'],))
        cols = ['id','title','message','type','is_read','created_at']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
            r['is_read'] = bool(r['is_read'])
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/my/notifications/read', methods=['POST'])
def mark_notifications_read():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("UPDATE notifications SET is_read=1 WHERE user_id=%s", (user['user_id'],))
        conn.commit()
        return jsonify({'message': 'Marked as read.'}), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ investor: my interests & their status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.route('/my/interests', methods=['GET'])
def my_interests():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT i.id, i.status, i.created_at,
                   p.title, p.industry, p.funding_goal, p.funding_stage,
                   u.first_name, u.last_name,
                   COALESCE(sp.company_name,'') AS company_name
            FROM interests i
            JOIN proposals p ON p.id = i.proposal_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN startup_profiles sp ON sp.user_id = p.user_id
            WHERE i.investor_id=%s ORDER BY i.created_at DESC
        """, (user['user_id'],))
        cols = ['id','status','created_at','title','industry','funding_goal',
                'funding_stage','first_name','last_name','company_name']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at']   = r['created_at'].isoformat() if r['created_at'] else None
            r['funding_goal'] = float(r['funding_goal']) if r['funding_goal'] else 0
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


# â”€â”€ run â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


@app.route('/investors/all', methods=['GET'])
def all_investors():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.first_name, u.last_name, u.email, u.created_at,
                   COALESCE(ip.firm_name,'') AS firm_name,
                   COALESCE(ip.investor_type,'') AS investor_type,
                   COALESCE(ip.investment_focus,'') AS investment_focus
            FROM users u
            LEFT JOIN investor_profiles ip ON ip.user_id = u.id
            WHERE u.role = 'investor' AND u.is_active = 1
            ORDER BY u.created_at DESC
        """)
        cols = ['id','first_name','last_name','email','created_at',
                'firm_name','investor_type','investment_focus']
        rows = [user_to_dict(r, cols) for r in cur.fetchall()]
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        return jsonify(rows), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()

# ── messaging routes ──────────────────────────────────────────────────────────

@app.route('/messages/conversations', methods=['GET'])
def get_conversations():
    """Get all accepted deals where current user can chat."""
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        uid = user['user_id']
        role = user['role']

        if role == 'startup':
            # get all accepted interests on my proposals
            cur.execute("""
                SELECT i.id AS interest_id, i.investor_id,
                       u.first_name, u.last_name, u.email,
                       COALESCE(ip.firm_name,'') AS firm_name,
                       p.id AS proposal_id, p.title AS proposal_title,
                       (SELECT COUNT(*) FROM messages m
                        WHERE m.proposal_id=p.id AND m.receiver_id=%s AND m.is_read=0) AS unread
                FROM interests i
                JOIN proposals p ON p.id = i.proposal_id
                JOIN users u ON u.id = i.investor_id
                LEFT JOIN investor_profiles ip ON ip.user_id = i.investor_id
                WHERE p.user_id=%s AND i.status='accepted'
                ORDER BY p.created_at DESC
            """, (uid, uid))
        else:
            # investor: get all accepted interests I have
            cur.execute("""
                SELECT i.id AS interest_id, p.user_id AS startup_user_id,
                       u.first_name, u.last_name, u.email,
                       COALESCE(sp.company_name, CONCAT(u.first_name,' ',u.last_name)) AS firm_name,
                       p.id AS proposal_id, p.title AS proposal_title,
                       (SELECT COUNT(*) FROM messages m
                        WHERE m.proposal_id=p.id AND m.receiver_id=%s AND m.is_read=0) AS unread
                FROM interests i
                JOIN proposals p ON p.id = i.proposal_id
                JOIN users u ON u.id = p.user_id
                LEFT JOIN startup_profiles sp ON sp.user_id = p.user_id
                WHERE i.investor_id=%s AND i.status='accepted'
                ORDER BY p.created_at DESC
            """, (uid, uid))

        rows = cur.fetchall()
        result = []
        for r in rows:
            if role == 'startup':
                result.append({
                    'interest_id':    r[0],
                    'other_user_id':  r[1],
                    'other_name':     r[2] + ' ' + r[3],
                    'other_email':    r[4],
                    'other_firm':     r[5],
                    'proposal_id':    r[6],
                    'proposal_title': r[7],
                    'unread':         r[8]
                })
            else:
                result.append({
                    'interest_id':    r[0],
                    'other_user_id':  r[1],
                    'other_name':     r[2] + ' ' + r[3],
                    'other_email':    r[4],
                    'other_firm':     r[5],
                    'proposal_id':    r[6],
                    'proposal_title': r[7],
                    'unread':         r[8]
                })
        return jsonify(result), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/messages/<int:proposal_id>/<int:other_user_id>', methods=['GET'])
def get_messages(proposal_id, other_user_id):
    """Get chat messages for a deal."""
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        uid = user['user_id']
        cur.execute("""
            SELECT m.id, m.sender_id, m.message, m.is_read, m.created_at,
                   u.first_name, u.last_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE m.proposal_id=%s
              AND ((m.sender_id=%s AND m.receiver_id=%s)
                OR (m.sender_id=%s AND m.receiver_id=%s))
            ORDER BY m.created_at ASC
        """, (proposal_id, uid, other_user_id, other_user_id, uid))
        rows = cur.fetchall()
        # mark as read
        cur.execute("""
            UPDATE messages SET is_read=1
            WHERE proposal_id=%s AND receiver_id=%s AND sender_id=%s
        """, (proposal_id, uid, other_user_id))
        conn.commit()
        result = [{
            'id': r[0], 'sender_id': r[1], 'message': r[2],
            'is_read': bool(r[3]),
            'created_at': r[4].isoformat() if r[4] else None,
            'sender_name': r[5] + ' ' + r[6],
            'is_mine': r[1] == uid
        } for r in rows]
        return jsonify(result), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/messages/<int:proposal_id>/<int:other_user_id>', methods=['POST'])
def send_message(proposal_id, other_user_id):
    """Send a message in a deal conversation."""
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    data = request.get_json()
    msg = (data.get('message') or '').strip()
    if not msg: return jsonify({'error': 'Message cannot be empty.'}), 400
    try:
        conn = get_connection(); cur = conn.cursor()
        uid = user['user_id']
        # verify they have an accepted deal on this proposal
        cur.execute("""
            SELECT COUNT(*) FROM interests i
            JOIN proposals p ON p.id = i.proposal_id
            WHERE i.proposal_id=%s AND i.status='accepted'
              AND ((p.user_id=%s AND i.investor_id=%s)
                OR (p.user_id=%s AND i.investor_id=%s))
        """, (proposal_id, uid, other_user_id, other_user_id, uid))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'No accepted deal found.'}), 403
        cur.execute("""
            INSERT INTO messages (sender_id, receiver_id, proposal_id, message)
            VALUES (%s, %s, %s, %s)
        """, (uid, other_user_id, proposal_id, msg))
        conn.commit()
        return jsonify({'message': 'Sent.', 'id': cur.lastrowid}), 201
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()

# ── meeting routes ────────────────────────────────────────────────────────────

@app.route('/meetings', methods=['GET'])
def get_meetings():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    try:
        conn = get_connection(); cur = conn.cursor()
        uid  = user['user_id']
        role = user['role']
        if role == 'startup':
            cur.execute("""
                SELECT m.id, m.title, m.meeting_date, m.meeting_time, m.meeting_type,
                       m.agenda, m.status, m.created_at,
                       u.first_name, u.last_name,
                       COALESCE(ip.firm_name,'') AS firm_name,
                       p.title AS proposal_title, m.proposal_id, m.investor_id
                FROM meetings m
                JOIN users u ON u.id = m.investor_id
                LEFT JOIN investor_profiles ip ON ip.user_id = m.investor_id
                JOIN proposals p ON p.id = m.proposal_id
                WHERE m.startup_id = %s
                ORDER BY m.meeting_date DESC, m.meeting_time DESC
            """, (uid,))
        else:
            cur.execute("""
                SELECT m.id, m.title, m.meeting_date, m.meeting_time, m.meeting_type,
                       m.agenda, m.status, m.created_at,
                       u.first_name, u.last_name,
                       COALESCE(sp.company_name, CONCAT(u.first_name,' ',u.last_name)) AS company,
                       p.title AS proposal_title, m.proposal_id, m.startup_id
                FROM meetings m
                JOIN users u ON u.id = m.startup_id
                LEFT JOIN startup_profiles sp ON sp.user_id = m.startup_id
                JOIN proposals p ON p.id = m.proposal_id
                WHERE m.investor_id = %s
                ORDER BY m.meeting_date DESC, m.meeting_time DESC
            """, (uid,))
        rows = cur.fetchall()
        cols = ['id','title','meeting_date','meeting_time','meeting_type','agenda',
                'status','created_at','other_first','other_last','other_org',
                'proposal_title','proposal_id','other_user_id']
        result = []
        for r in rows:
            d = dict(zip(cols, r))
            d['other_name']   = d.pop('other_first') + ' ' + d.pop('other_last')
            d['meeting_date'] = str(d['meeting_date']) if d['meeting_date'] else None
            d['meeting_time'] = str(d['meeting_time']) if d['meeting_time'] else None
            d['created_at']   = d['created_at'].isoformat() if d['created_at'] else None
            result.append(d)
        return jsonify(result), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/meetings', methods=['POST'])
def create_meeting():
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    if user['role'] != 'startup': return jsonify({'error': 'Only startups can schedule meetings.'}), 403
    data = request.get_json()
    proposal_id  = data.get('proposal_id')
    investor_id  = data.get('investor_id')
    title        = (data.get('title') or '').strip()
    meeting_date = data.get('meeting_date')
    meeting_time = data.get('meeting_time')
    meeting_type = data.get('meeting_type', 'Video Call')
    agenda       = (data.get('agenda') or '').strip()
    if not all([proposal_id, investor_id, title, meeting_date, meeting_time]):
        return jsonify({'error': 'All required fields must be filled.'}), 400
    try:
        conn = get_connection(); cur = conn.cursor()
        # verify accepted deal exists
        cur.execute("""
            SELECT COUNT(*) FROM interests i JOIN proposals p ON p.id=i.proposal_id
            WHERE i.proposal_id=%s AND i.investor_id=%s AND i.status='accepted' AND p.user_id=%s
        """, (proposal_id, investor_id, user['user_id']))
        if cur.fetchone()[0] == 0:
            return jsonify({'error': 'No accepted deal found with this investor.'}), 403
        cur.execute("""
            INSERT INTO meetings (proposal_id, startup_id, investor_id, title,
                                  meeting_date, meeting_time, meeting_type, agenda)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (proposal_id, user['user_id'], investor_id, title,
              meeting_date, meeting_time, meeting_type, agenda))
        mid = cur.lastrowid
        # notify investor
        cur.execute("""
            SELECT u.first_name, u.last_name FROM users u WHERE u.id=%s
        """, (user['user_id'],))
        row = cur.fetchone()
        startup_name = row[0] + ' ' + row[1] if row else 'The startup'
        cur.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s,%s,%s,'info')
        """, (investor_id,
              'Meeting Scheduled',
              f'{startup_name} has scheduled a {meeting_type} with you on {meeting_date} at {meeting_time} regarding "{title}". Please confirm.'))
        conn.commit()
        return jsonify({'message': 'Meeting scheduled.', 'id': mid}), 201
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()


@app.route('/meetings/<int:mid>/status', methods=['POST'])
def update_meeting_status(mid):
    user = get_current_user()
    if not user: return jsonify({'error': 'Not authenticated.'}), 401
    data   = request.get_json()
    status = data.get('status')
    if status not in ('confirmed','declined','cancelled'):
        return jsonify({'error': 'Invalid status.'}), 400
    try:
        conn = get_connection(); cur = conn.cursor()
        uid = user['user_id']
        # investor can confirm/decline; startup can cancel
        if user['role'] == 'investor':
            cur.execute("SELECT startup_id, title FROM meetings WHERE id=%s AND investor_id=%s", (mid, uid))
        else:
            cur.execute("SELECT startup_id, title FROM meetings WHERE id=%s AND startup_id=%s", (mid, uid))
        row = cur.fetchone()
        if not row: return jsonify({'error': 'Meeting not found.'}), 404
        startup_id, meeting_title = row
        cur.execute("UPDATE meetings SET status=%s WHERE id=%s", (status, mid))
        # notify the other party
        if user['role'] == 'investor':
            msg = f'Your meeting "{meeting_title}" has been {status} by the investor.'
            notify_user = startup_id
        else:
            cur.execute("SELECT investor_id FROM meetings WHERE id=%s", (mid,))
            notify_user = cur.fetchone()[0]
            msg = f'The meeting "{meeting_title}" has been {status} by the startup.'
        cur.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (%s,%s,%s,'info')
        """, (notify_user, f'Meeting {status.capitalize()}', msg))
        conn.commit()
        return jsonify({'message': f'Meeting {status}.'}), 200
    except Exception as e: return jsonify({'error': str(e)}), 500
    finally: cur.close(); conn.close()
if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)




