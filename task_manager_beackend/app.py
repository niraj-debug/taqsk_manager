from flask import Flask, request, jsonify, g, redirect, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from db import get_db_connection
import bcrypt
import jwt
import os
import uuid
import secrets
from werkzeug.utils import secure_filename
import logging
import urllib.parse
import requests
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from functools import wraps
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv()

logger = logging.getLogger(__name__)

app = Flask(__name__)

from flask.json.provider import DefaultJSONProvider
import datetime as dt_module

class CustomJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, (dt_module.date, dt_module.datetime)):
            return o.isoformat()
        return super().default(o)

app.json = CustomJSONProvider(app)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")
app.config["SECRET_KEY"] = SECRET_KEY

# Allow React frontend — restrict origins in production via env
ALLOWED_ORIGINS = [orig.strip() for orig in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

# Rate limiting — protects auth endpoints from brute force
limiter = Limiter(key_func=get_remote_address, app=app, default_limits=[])


# Uploads configuration
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(os.getcwd(), 'uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route('/uploads/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS task_activities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id INT NOT NULL,
                user_id INT NOT NULL,
                activity_type VARCHAR(50) NOT NULL,
                content TEXT NULL,
                file_path VARCHAR(255) NULL,
                file_name VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.commit()

        # Run schema migrations automatically on startup
        import mysql.connector
        migrations = [
            "ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0",
            "ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME DEFAULT NULL",
            "UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"
        ]
        for stmt in migrations:
            try:
                cursor.execute(stmt)
                conn.commit()
            except mysql.connector.Error as err:
                if err.errno != 1060: # 1060 = duplicate column name (ignore it)
                    logger.warning("Migration error for stmt: %s -> %s", stmt, err.msg)
            except Exception as e:
                logger.warning("Migration exception: %s", e)
    except Exception as e:
        logger.exception("Failed to initialize database: %s", e)
    finally:
        cursor.close()
        conn.close()

init_db()


# -----------------------
# HELPERS
# -----------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def generate_token(user_id: int, role: str, group_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "group_id": group_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def require_auth(f):
    """Decorator: validates JWT and injects g.user_id / g.role / g.group_id."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        parts = auth_header.split(" ", 1)
        if len(parts) < 2:
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        token = parts[1]
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            g.user_id = int(payload["sub"])
            g.role = payload["role"]
            g.group_id = int(payload.get("group_id", 0))
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator: must be used after @require_auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if g.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def validate_fields(data: dict, required: list) -> str | None:
    """Returns an error message if any required field is missing/empty."""
    for field in required:
        if not data.get(field):
            return f"'{field}' is required"
    return None


def server_error(conn, e):
    """Roll back, log the real exception, and return a generic 500."""
    try:
        conn.rollback()
    except Exception:
        pass
    logger.exception("Unhandled error: %s", e)
    return jsonify({"error": "Internal server error"}), 500


def can_modify_task(cursor, task_id: int) -> bool:
    """True if the current user owns the task or is an admin.

    Assumes a cursor with dictionary=True. Returns False if the task
    does not exist so callers can surface a 404/403 as appropriate.
    """
    if g.role == "admin":
        return True
    cursor.execute("SELECT created_by FROM tasks WHERE id=%s", (task_id,))
    row = cursor.fetchone()
    return bool(row) and row["created_by"] == g.user_id


# -----------------------
# HEALTH CHECK
# -----------------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Task Crusader API running"})


# =======================
# AUTHENTICATION
# =======================
@app.route("/register", methods=["POST"])
@limiter.limit("100 per minute")
def register():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["name", "email", "password"])
    if err:
        return jsonify({"error": err}), 400

    name = data["name"].strip()
    email = data["email"].strip().lower()
    password = data["password"]

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    invite_group = data.get("invite_group")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cursor.fetchone():
            return jsonify({"error": "User already exists"}), 400

        if invite_group:
            role = "member"
            group_id = int(invite_group)
        else:
            role = "admin"
            group_id = None

        hashed = hash_password(password)
        verification_token = secrets.token_hex(20)
        cursor.execute(
            """
            INSERT INTO users (name, email, password, role, group_id, is_verified, verification_token) 
            VALUES (%s, %s, %s, %s, %s, 0, %s)
            """,
            (name, email, hashed, role, group_id, verification_token),
        )
        conn.commit()
        user_id = cursor.lastrowid

        if not invite_group:
            group_id = user_id
            cursor.execute("UPDATE users SET group_id=%s WHERE id=%s", (group_id, user_id))
            conn.commit()

        # Send email verification link
        send_verification_email(email, name, verification_token)

        return jsonify({"message": "Registration successful. Please check your email to verify your account."}), 201

    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/login", methods=["POST"])
@limiter.limit("100 per minute")
def login():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["email", "password"])
    if err:
        return jsonify({"error": err}), 400

    email = data["email"].strip().lower()
    password = data["password"]
    invite_group = data.get("invite_group")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, name, email, role, group_id, password, is_verified FROM users WHERE email=%s", (email,)
        )
        user = cursor.fetchone()

        if not user or not check_password(password, user["password"]):
            return jsonify({"error": "Invalid email or password"}), 401

        if not user["is_verified"]:
            return jsonify({"error": "Please verify your email to log in."}), 403

        role = user["role"]
        group_id = user["group_id"]

        if invite_group:
            role = "member"
            group_id = int(invite_group)
            cursor.execute(
                "UPDATE users SET group_id=%s, role='member' WHERE id=%s",
                (group_id, user["id"])
            )
            conn.commit()

        token = generate_token(user["id"], role, group_id)
        return jsonify({
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": role,
            "group_id": group_id,
            "token": token,
        })

    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/verify-email", methods=["POST"])
@limiter.limit("20 per minute")
def verify_email():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["token"])
    if err:
        return jsonify({"error": err}), 400

    token = data["token"].strip()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE verification_token=%s", (token,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "Invalid or expired verification token"}), 400

        cursor.execute(
            "UPDATE users SET is_verified=1, verification_token=NULL WHERE id=%s",
            (user["id"],)
        )
        conn.commit()
        return jsonify({"message": "Email verified successfully! You can now log in."})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/resend-verification", methods=["POST"])
@limiter.limit("5 per minute")
def resend_verification():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["email"])
    if err:
        return jsonify({"error": err}), 400

    email = data["email"].strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name, is_verified FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "If this email is registered, a new verification link has been sent."})

        if user["is_verified"]:
            return jsonify({"error": "This email is already verified."}), 400

        new_token = secrets.token_hex(20)
        cursor.execute(
            "UPDATE users SET verification_token=%s WHERE id=%s",
            (new_token, user["id"])
        )
        conn.commit()

        send_verification_email(email, user["name"], new_token)
        return jsonify({"message": "If this email is registered, a new verification link has been sent."})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/forgot-password", methods=["POST"])
@limiter.limit("5 per minute")
def forgot_password():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["email"])
    if err:
        return jsonify({"error": err}), 400

    email = data["email"].strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "If this email is registered, a password reset link has been sent."})

        reset_token = secrets.token_hex(20)
        expiry = datetime.now() + timedelta(hours=1)

        cursor.execute(
            "UPDATE users SET reset_token=%s, reset_token_expiry=%s WHERE id=%s",
            (reset_token, expiry, user["id"])
        )
        conn.commit()

        send_password_reset_email(email, user["name"], reset_token)
        return jsonify({"message": "If this email is registered, a password reset link has been sent."})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/reset-password", methods=["POST"])
@limiter.limit("10 per minute")
def reset_password():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["token", "password"])
    if err:
        return jsonify({"error": err}), 400

    token = data["token"].strip()
    password = data["password"]

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, reset_token_expiry FROM users WHERE reset_token=%s",
            (token,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "Invalid or expired reset token"}), 400

        expiry = user["reset_token_expiry"]
        if expiry and expiry < datetime.now():
            return jsonify({"error": "Reset token has expired"}), 400

        hashed = hash_password(password)
        cursor.execute(
            "UPDATE users SET password=%s, reset_token=NULL, reset_token_expiry=NULL WHERE id=%s",
            (hashed, user["id"])
        )
        conn.commit()

        return jsonify({"message": "Password reset successful! You can now log in with your new password."})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/join-group", methods=["POST"])
@require_auth
def join_group():
    data = request.get_json(silent=True) or {}
    group_id = data.get("group_id")
    if not group_id:
        return jsonify({"error": "'group_id' is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE users SET group_id=%s, role='member' WHERE id=%s", (int(group_id), g.user_id))
        conn.commit()

        new_token = generate_token(g.user_id, "member", int(group_id))
        return jsonify({
            "message": "Successfully joined workspace group",
            "token": new_token,
            "role": "member"
        })
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/leave-group", methods=["POST"])
@require_auth
def leave_group():
    if g.user_id == g.group_id:
        return jsonify({"error": "Workspace owners cannot leave their own workspace"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Reset group_id = id and role = 'admin'
        cursor.execute(
            "UPDATE users SET group_id = id, role = 'admin' WHERE id = %s",
            (g.user_id,)
        )

        # Remove project memberships in the old workspace group
        cursor.execute(
            """
            DELETE FROM project_members 
            WHERE user_id = %s 
              AND project_id IN (SELECT id FROM projects WHERE group_id = %s)
            """,
            (g.user_id, g.group_id)
        )

        # Remove task assignments in the old workspace group
        cursor.execute(
            """
            DELETE FROM task_assignments 
            WHERE user_id = %s 
              AND task_id IN (
                SELECT t.id FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE p.group_id = %s 
                   OR (t.project_id IS NULL AND t.created_by IN (SELECT id FROM users WHERE group_id = %s))
              )
            """,
            (g.user_id, g.group_id, g.group_id)
        )

        # Unassign from tasks directly
        cursor.execute(
            """
            UPDATE tasks 
            SET assigned_to = NULL 
            WHERE assigned_to = %s 
              AND (project_id IN (SELECT id FROM projects WHERE group_id = %s) 
                   OR (project_id IS NULL AND created_by IN (SELECT id FROM users WHERE group_id = %s)))
            """,
            (g.user_id, g.group_id, g.group_id)
        )

        conn.commit()

        # Generate a new token for the user with their individual group_id
        new_token = generate_token(g.user_id, "admin", g.user_id)

        return jsonify({
            "message": "Successfully left the workspace group",
            "token": new_token,
            "role": "admin"
        })
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


# =======================
# GOOGLE OAUTH
# =======================

@app.route("/auth/google", methods=["GET"])
def google_auth_login():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")
    
    invite_group = request.args.get("invite_group")
    state_data = {}
    if invite_group:
        state_data["invite_group"] = invite_group
    state_str = json.dumps(state_data) if state_data else ""

    if not client_id:
        return f"""
        <html>
            <head>
                <title>Task Crusader Google Auth Simulator</title>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
                    .card {{ background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); max-width: 400px; width: 100%; text-align: center; border: 1px solid #f0f0f0; }}
                    h1 {{ font-size: 24px; font-weight: 800; margin-bottom: 10px; color: #111; }}
                    p {{ color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
                    .input-group {{ margin-bottom: 16px; text-align: left; }}
                    label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; color: #999; display: block; margin-bottom: 6px; }}
                    input {{ width: 100%; padding: 12px; border: 1px solid #e0e0e0; border-radius: 12px; font-size: 14px; box-sizing: border-box; }}
                    button {{ width: 100%; padding: 14px; background: #FF7F50; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; }}
                    button:hover {{ background: #e06c43; transform: translateY(-1px); }}
                    .alert {{ background: #fff5f2; border: 1px solid #ffe3db; color: #ff5a2b; padding: 12px; border-radius: 12px; font-size: 12px; margin-bottom: 20px; font-weight: 500; text-align: left; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Google Sign-In Simulator</h1>
                    <div class="alert">
                        <strong>Developer Notice:</strong> <code>GOOGLE_CLIENT_ID</code> is not configured in your backend <code>.env</code>. Running simulator.
                    </div>
                    <p>Enter email and name to simulate a successful Google OAuth login flow.</p>
                    <form action="/auth/google/callback" method="GET">
                        <div class="input-group">
                            <label>Full Name</label>
                            <input type="text" name="mock_name" value="Developer User" required />
                        </div>
                        <div class="input-group">
                            <label>Email Address</label>
                            <input type="email" name="mock_email" value="developer@example.com" required />
                        </div>
                        <input type="hidden" name="code" value="mock_authorization_code" />
                        <input type="hidden" name="state" value='{state_str}' />
                        <button type="submit">Authorize Task Crusader</button>
                    </form>
                </div>
            </body>
        </html>
        """
        
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    if state_str:
        params["state"] = state_str
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return redirect(url)


@app.route("/auth/google/callback", methods=["GET"])
def google_auth_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "No authorization code provided"}), 400
        
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    mock_email = request.args.get("mock_email")
    mock_name = request.args.get("mock_name")
    
    email = None
    name = None
    avatar = None
    
    if not client_id or code == "mock_authorization_code" or mock_email:
        email = (mock_email or "developer@example.com").strip().lower()
        name = (mock_name or "Developer User").strip()
        avatar = f"https://api.dicebear.com/7.x/adventurer/svg?seed={name}"
    else:
        try:
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }
            token_res = requests.post(token_url, data=token_data)
            if not token_res.ok:
                return jsonify({"error": "Failed to exchange authorization code", "details": token_res.text}), 400
            
            token_json = token_res.json()
            access_token = token_json.get("access_token")
            
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            userinfo_headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_res = requests.get(userinfo_url, headers=userinfo_headers)
            if not userinfo_res.ok:
                return jsonify({"error": "Failed to retrieve user profile from Google"}), 400
                
            userinfo = userinfo_res.json()
            email = userinfo.get("email", "").strip().lower()
            name = userinfo.get("name", "").strip()
            avatar = userinfo.get("picture", "")
            
        except Exception as e:
            logger.exception("Google OAuth error: %s", e)
            return jsonify({"error": "Google authentication failed"}), 500
            
    if not email:
        return jsonify({"error": "Could not retrieve email from Google profile"}), 400
        
    state = request.args.get("state")
    invite_group = None
    if state:
        try:
            state_data = json.loads(urllib.parse.unquote(state) if "%" in state else state)
            invite_group = state_data.get("invite_group")
        except Exception:
            pass

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()
        
        if user:
            cursor.execute(
                "UPDATE users SET name=%s, avatar=%s, is_verified=1, last_active=NOW() WHERE id=%s",
                (name, avatar, user["id"])
            )
            conn.commit()
            user_id = user["id"]
            role = user["role"]
            group_id = user["group_id"]
        else:
            if invite_group:
                role = "member"
                group_id = int(invite_group)
            else:
                role = "admin"
                group_id = None
            
            cursor.execute(
                """
                INSERT INTO users (name, email, password, avatar, provider, role, group_id, is_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1)
                """,
                (name, email, None, avatar, "google", role, group_id)
            )
            conn.commit()
            user_id = cursor.lastrowid
            
            if not invite_group:
                group_id = user_id
                cursor.execute("UPDATE users SET group_id=%s WHERE id=%s", (group_id, user_id))
                conn.commit()
            
        token = generate_token(user_id, role, group_id)
        
        params = {
            "token": token,
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "group_id": group_id,
            "avatar": avatar or ""
        }
        redirect_url = frontend_url + "/?" + urllib.parse.urlencode(params)
        return redirect(redirect_url)
        
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


# =======================
# USERS / MEMBERS
# =======================

@app.route("/users", methods=["GET"])
@require_auth
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, name, email, role, created_at FROM users WHERE group_id=%s ORDER BY created_at DESC",
            (g.group_id,)
        )
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/users/<int:id>/role", methods=["PUT"])
@require_auth
@require_admin
def update_user_role(id):
    data = request.get_json(silent=True) or {}
    new_role = data.get("role")
    if new_role not in ("admin", "member"):
        return jsonify({"error": "Role must be 'admin' or 'member'"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET role=%s WHERE id=%s", (new_role, id))
        conn.commit()
        return jsonify({"message": "Role updated"})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/users/<int:id>", methods=["DELETE"])
@require_auth
@require_admin
def delete_user(id):
    if id == g.user_id:
        return jsonify({"error": "Cannot delete your own account"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if the user exists and is a member of the admin's group
        cursor.execute("SELECT id, group_id FROM users WHERE id=%s AND group_id=%s", (id, g.group_id))
        user_to_remove = cursor.fetchone()
        if not user_to_remove:
            return jsonify({"error": "User is not a member of your workspace group"}), 404

        # Instead of deleting from users, reset group_id = id and role = 'admin' so they access app individually
        cursor.execute(
            "UPDATE users SET group_id = id, role = 'admin' WHERE id = %s AND group_id = %s",
            (id, g.group_id)
        )

        # Remove user from project memberships in this workspace group
        cursor.execute(
            """
            DELETE FROM project_members 
            WHERE user_id = %s 
              AND project_id IN (SELECT id FROM projects WHERE group_id = %s)
            """,
            (id, g.group_id)
        )

        # Remove from task assignments in this workspace group
        cursor.execute(
            """
            DELETE FROM task_assignments 
            WHERE user_id = %s 
              AND task_id IN (
                SELECT t.id FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE p.group_id = %s 
                   OR (t.project_id IS NULL AND t.created_by IN (SELECT id FROM users WHERE group_id = %s))
              )
            """,
            (id, g.group_id, g.group_id)
        )

        # Unassign from tasks directly
        cursor.execute(
            """
            UPDATE tasks 
            SET assigned_to = NULL 
            WHERE assigned_to = %s 
              AND (project_id IN (SELECT id FROM projects WHERE group_id = %s) 
                   OR (project_id IS NULL AND created_by IN (SELECT id FROM users WHERE group_id = %s)))
            """,
            (id, g.group_id, g.group_id)
        )

        conn.commit()
        return jsonify({"message": "User removed from workspace successfully"})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


def send_http_email(recipient_email: str, subject: str, html_content: str) -> tuple[bool, str]:
    # 1. Brevo API Mailer (Free 300 emails/day, lets you send to anyone)
    brevo_key = os.getenv("BREVO_API_KEY")
    if brevo_key:
        try:
            sender_email = os.getenv("SMTP_SENDER", os.getenv("SMTP_USERNAME", "taskcrusader@gmail.com"))
            headers = {
                "api-key": brevo_key,
                "Content-Type": "application/json"
            }
            data = {
                "sender": {"name": "Task Crusader", "email": sender_email},
                "to": [{"email": recipient_email}],
                "subject": subject,
                "htmlContent": html_content
            }
            r = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data, timeout=5)
            if r.status_code in (200, 201, 202):
                return True, "Email sent via Brevo API."
            else:
                logger.error("Brevo API failed: %s", r.text)
        except Exception as e:
            logger.exception("Brevo sending failed: %s", e)

    # 2. Resend API Mailer (Free 3,000 emails/month)
    resend_key = os.getenv("RESEND_API_KEY")
    if resend_key:
        try:
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            data = {
                "from": "Task Crusader <onboarding@resend.dev>",
                "to": [recipient_email],
                "subject": subject,
                "html": html_content
            }
            r = requests.post("https://api.resend.com/emails", headers=headers, json=data, timeout=5)
            if r.status_code in (200, 201, 202):
                return True, "Email sent via Resend API."
            else:
                logger.error("Resend API failed: %s", r.text)
        except Exception as e:
            logger.exception("Resend sending failed: %s", e)

    return False, "No HTTP Mail provider configured or succeeded."


def send_system_email(recipient_email: str, subject: str, html_content: str, fallback_sim_header: str, fallback_sim_body: str) -> tuple[bool, str]:
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_sender = os.getenv("SMTP_SENDER", smtp_username)

    # Try HTTP email APIs first (never blocked by cloud host SMTP firewalls)
    sent_http, detail_http = send_http_email(recipient_email, subject, html_content)
    if sent_http:
        logger.info("System email sent successfully via API to %s", recipient_email)
        return True, "Email sent successfully."

    if not smtp_server or not smtp_username or not smtp_password:
        logger.warning("SMTP credentials not fully configured. Email simulated.")
        print(f"\n[{fallback_sim_header}] To: {recipient_email}\nSubject: {subject}\n{fallback_sim_body}\n")
        return True, "Email simulated."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Task Crusader <{smtp_sender}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=5)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=5)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_sender, recipient_email, msg.as_string())
        server.quit()
        logger.info("System email sent successfully to %s", recipient_email)
        return True, "Email sent successfully."
    except Exception as e:
        logger.exception("Failed to send system email to %s: %s. Simulating success fallback.", recipient_email, e)
        print(f"\n[{fallback_sim_header} (FALLBACK)] To: {recipient_email}\nSubject: {subject}\n{fallback_sim_body}\n")
        return True, "Email simulated (SMTP failed)."


def send_verification_email(recipient_email: str, recipient_name: str, verification_token: str) -> tuple[bool, str]:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    verification_link = f"{frontend_url}/?verify_token={verification_token}"
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #FF7F50; margin: 0;">Task Crusader</h2>
                    <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Verify Your Email Address</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #f0f0f0;" />
                <p>Hello <strong>{recipient_name or "there"}</strong>,</p>
                <p>Thank you for signing up for <strong>Task Crusader</strong>! Please verify your email address to complete your registration and activate your account:</p>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{verification_link}" style="background-color: #FF7F50; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">Verify Email Address</a>
                </div>
                <p style="font-size: 13px; color: #888;">Or copy this link into your browser:</p>
                <p style="font-size: 12px; color: #FF7F50; word-break: break-all;">{verification_link}</p>
                <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">If you did not sign up for this account, you can safely ignore this email.</p>
            </div>
        </body>
    </html>
    """
    return send_system_email(
        recipient_email,
        "Verify your Task Crusader account",
        html,
        "SIMULATED VERIFICATION EMAIL",
        f"Verification Link: {verification_link}"
    )


def send_password_reset_email(recipient_email: str, recipient_name: str, reset_token: str) -> tuple[bool, str]:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/?reset_token={reset_token}"
    
    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #FF7F50; margin: 0;">Task Crusader</h2>
                    <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Reset Your Password</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #f0f0f0;" />
                <p>Hello <strong>{recipient_name or "there"}</strong>,</p>
                <p>We received a request to reset the password for your <strong>Task Crusader</strong> account. Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{reset_link}" style="background-color: #FF7F50; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
                </div>
                <p style="font-size: 13px; color: #888;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
                <p style="font-size: 12px; color: #FF7F50; word-break: break-all;">{reset_link}</p>
                <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 20px 0;" />
            </div>
        </body>
    </html>
    """
    return send_system_email(
        recipient_email,
        "Reset your Task Crusader password",
        html,
        "SIMULATED PASSWORD RESET EMAIL",
        f"Reset Link: {reset_link}"
    )


def send_invitation_email(recipient_email: str, recipient_name: str, group_id: int = None) -> tuple[bool, str]:
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_sender = os.getenv("SMTP_SENDER", smtp_username)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    signup_url = frontend_url + "?signup=true"
    if group_id:
        signup_url += f"&invite_group={group_id}"

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #FF7F50; margin: 0;">Task Crusader</h2>
                    <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Crush Chaos, Win Big</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #f0f0f0;" />
                <p>Hello <strong>{recipient_name or "there"}</strong>,</p>
                <p>You have been invited to join the <strong>Task Crusader</strong> workspace!</p>
                <p>Click the button below to create your account and start collaborating with your team:</p>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{signup_url}" style="background-color: #FF7F50; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">Join Task Crusader</a>
                </div>
                <p style="font-size: 13px; color: #888;">Or copy this link into your browser:</p>
                <p style="font-size: 12px; color: #FF7F50; word-break: break-all;">{signup_url}</p>
                <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
        </body>
    </html>
    """

    # Try HTTP email APIs first (never blocked by cloud host SMTP firewalls)
    sent_http, detail_http = send_http_email(recipient_email, "You're invited to Task Crusader!", html)
    if sent_http:
        logger.info("Invitation email sent successfully via API to %s", recipient_email)
        return True, "Invitation email sent."

    if not smtp_server or not smtp_username or not smtp_password:
        logger.warning(
            "SMTP credentials not fully configured. Email invitation simulated. "
            "Recipient: %s",
            recipient_email
        )
        print(f"\n[SIMULATED EMAIL] To: {recipient_email}\nLink: {signup_url}\n")
        return True, "Invitation email simulated."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "You're invited to Task Crusader!"
        msg["From"] = f"Task Crusader <{smtp_sender}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html, "html"))

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=5)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=5)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_sender, recipient_email, msg.as_string())
        server.quit()
        logger.info("Invitation email sent successfully to %s", recipient_email)
        return True, "Invitation email sent."
    except Exception as e:
        logger.exception("Failed to send invitation email to %s: %s. Simulating success fallback.", recipient_email, e)
        print(f"\n[SIMULATED EMAIL (FALLBACK)] To: {recipient_email}\nLink: {signup_url}\n")
        return True, "Invitation email simulated (SMTP failed)."


def send_member_message_email(recipient_email: str, recipient_name: str, sender_name: str, subject: str, body: str) -> tuple[bool, str]:
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_sender = os.getenv("SMTP_SENDER", smtp_username)

    html = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #FF7F50; margin: 0;">Task Crusader Message</h2>
                    <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">New direct message from {sender_name}</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #f0f0f0;" />
                <p>Hello <strong>{recipient_name or "there"}</strong>,</p>
                <p>You have received a new message from your teammate <strong>{sender_name}</strong> on Task Crusader:</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #FF7F50; border-radius: 4px; margin: 20px 0; white-space: pre-wrap;">
{body}
                </div>
                <hr style="border: 0; border-top: 1px solid #f0f0f0; margin: 20px 0;" />
                <p style="font-size: 12px; color: #999;">Reply directly to this email or contact them via email at their registered address.</p>
            </div>
        </body>
    </html>
    """

    # Try HTTP email APIs first (never blocked by cloud host SMTP firewalls)
    sent_http, detail_http = send_http_email(recipient_email, f"[Task Crusader] {subject}", html)
    if sent_http:
        logger.info("Message email sent successfully via API to %s", recipient_email)
        return True, "Message email sent."

    if not smtp_server or not smtp_username or not smtp_password:
        logger.warning("SMTP credentials not fully configured. Email message simulated.")
        print(f"\n[SIMULATED MESSAGE] From: {sender_name}\nTo: {recipient_email}\nSubject: {subject}\nBody: {body}\n")
        return True, "Message email simulated."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[Task Crusader] {subject}"
        msg["From"] = f"Task Crusader <{smtp_sender}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html, "html"))

        port = int(smtp_port)
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_server, port, timeout=5)
        else:
            server = smtplib.SMTP(smtp_server, port, timeout=5)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_sender, recipient_email, msg.as_string())
        server.quit()
        logger.info("Message email sent successfully to %s", recipient_email)
        return True, "Message email sent."
    except Exception as e:
        logger.exception("Failed to send message email to %s: %s. Simulating success fallback.", recipient_email, e)
        print(f"\n[SIMULATED MESSAGE (FALLBACK)] From: {sender_name}\nTo: {recipient_email}\nSubject: {subject}\nBody: {body}\n")
        return True, "Message email simulated (SMTP failed)."


@app.route("/users/<int:id>/message", methods=["POST"])
@require_auth
def message_user(id):
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["subject", "message"])
    if err:
        return jsonify({"error": err}), 400

    subject = data["subject"].strip()
    message_body = data["message"].strip()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Fetch recipient email & name
        cursor.execute("SELECT name, email FROM users WHERE id=%s", (id,))
        recipient = cursor.fetchone()
        if not recipient:
            return jsonify({"error": "Recipient user not found"}), 404

        # Fetch sender name
        cursor.execute("SELECT name FROM users WHERE id=%s", (g.user_id,))
        sender = cursor.fetchone()
        sender_name = sender["name"] if sender else "A teammate"

        sent, detail = send_member_message_email(
            recipient["email"],
            recipient["name"],
            sender_name,
            subject,
            message_body
        )

        if sent:
            return jsonify({"message": f"Message successfully sent to {recipient['name']}"}), 200
        else:
            return jsonify({"error": detail}), 500
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/users/add", methods=["POST"])
@require_auth
@require_admin
def add_user():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["name", "email", "password"])
    if err:
        return jsonify({"error": err}), 400

    if len(data["password"]) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE email=%s", (data["email"].strip().lower(),))
        if cursor.fetchone():
            return jsonify({"error": "Email already in use"}), 400

        hashed = hash_password(data["password"])
        cursor.execute(
            "INSERT INTO users (name, email, password, role, group_id) VALUES (%s, %s, %s, 'member', %s)",
            (data["name"].strip(), data["email"].strip().lower(), hashed, g.group_id),
        )
        conn.commit()
        return jsonify({"message": "Member added successfully"}), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/invite", methods=["POST"])
@require_auth
@require_admin
def invite_user():
    """Send an email-only invitation — no account is created."""
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["email"])
    if err:
        return jsonify({"error": err}), 400

    email = data["email"].strip().lower()
    name = data.get("name", "").strip()

    sent, detail = send_invitation_email(email, name, group_id=g.group_id)

    if sent:
        return jsonify({"message": f"Invitation sent to {email}"}), 200
    elif detail == "SMTP not configured":
        return jsonify({"error": "SMTP is not configured. Please set SMTP_SERVER, SMTP_USERNAME, and SMTP_PASSWORD in your .env file."}), 500
    else:
        return jsonify({"error": detail}), 500


# =======================
# PROJECTS
# =======================

@app.route("/projects", methods=["POST"])
@require_auth
def create_project():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["name"])
    if err:
        return jsonify({"error": err}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO projects (name, description, priority, category, start_date, due_date, created_by, group_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data["name"].strip(),
                data.get("description", ""),
                data.get("priority", "Medium"),
                data.get("category", "General"),
                data.get("start_date"),
                data.get("due_date"),
                g.user_id,
                g.group_id,
            ),
        )
        conn.commit()
        return jsonify({"message": "Project created"}), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects", methods=["GET"])
@require_auth
def get_projects():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM projects WHERE group_id=%s ORDER BY id DESC", (g.group_id,))
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:id>", methods=["DELETE"])
@require_auth
@require_admin
def delete_project(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM projects WHERE id=%s", (id,))
        conn.commit()
        return jsonify({"message": "Project deleted"})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:project_id>/progress", methods=["GET"])
@require_auth
def project_progress(project_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as total FROM tasks WHERE project_id=%s", (project_id,))
        total = cursor.fetchone()["total"]

        cursor.execute(
            "SELECT COUNT(*) as completed FROM tasks WHERE project_id=%s AND status='completed'",
            (project_id,),
        )
        completed = cursor.fetchone()["completed"]

        progress = round((completed / total) * 100) if total > 0 else 0
        return jsonify({"total_tasks": total, "completed_tasks": completed, "progress": progress})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:project_id>/members", methods=["POST"])
@require_auth
@require_admin
def add_project_member(project_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "'user_id' is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT IGNORE INTO project_members (project_id, user_id) VALUES (%s, %s)",
            (project_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Member added"}), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:project_id>/members", methods=["GET"])
@require_auth
def get_project_members(project_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT users.id, users.name, users.email
            FROM project_members
            JOIN users ON users.id = project_members.user_id
            WHERE project_members.project_id=%s
            """,
            (project_id,),
        )
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:project_id>/members/<int:user_id>", methods=["DELETE"])
@require_auth
@require_admin
def remove_project_member(project_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM project_members WHERE project_id=%s AND user_id=%s",
            (project_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Member removed from project"})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


# =======================
# TASKS
# =======================

VALID_STATUSES = {"todo", "in_progress", "completed"}
VALID_PRIORITIES = {"Low", "Medium", "High", "Urgent"}


@app.route("/tasks", methods=["GET"])
@require_auth
def get_tasks():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT 
                tasks.*, 
                users.name AS assigned_user,
                la.content AS latest_activity_content,
                la.activity_type AS latest_activity_type,
                la.user_name AS latest_activity_user_name
            FROM tasks
            LEFT JOIN projects ON tasks.project_id = projects.id
            LEFT JOIN users ON tasks.assigned_to = users.id
            LEFT JOIN (
                SELECT ta1.task_id, ta1.content, ta1.activity_type, u.name AS user_name
                FROM task_activities ta1
                JOIN users u ON ta1.user_id = u.id
                WHERE ta1.activity_type IN ('progress_share', 'work_upload')
                  AND ta1.id = (
                    SELECT MAX(ta2.id) 
                    FROM task_activities ta2 
                    WHERE ta2.task_id = ta1.task_id
                      AND ta2.activity_type IN ('progress_share', 'work_upload')
                )
            ) la ON tasks.id = la.task_id
            WHERE projects.group_id = %s OR (tasks.project_id IS NULL AND tasks.created_by IN (SELECT id FROM users WHERE group_id = %s))
            ORDER BY tasks.id DESC
            """,
            (g.group_id, g.group_id)
        )
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks", methods=["POST"])
@require_auth
def add_task():
    data = request.get_json(silent=True) or {}
    err = validate_fields(data, ["title"])
    if err:
        return jsonify({"error": err}), 400

    status = data.get("status", "todo")
    priority = data.get("priority", "Medium")
    assigned_to = data.get("assigned_to")
    if assigned_to == "":
        assigned_to = None

    if status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of {sorted(VALID_STATUSES)}"}), 400
    if priority not in VALID_PRIORITIES:
        return jsonify({"error": f"priority must be one of {sorted(VALID_PRIORITIES)}"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            INSERT INTO tasks (title, description, priority, category, status, due_date, created_by, project_id, assigned_to)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data["title"].strip(),
                data.get("description", ""),
                priority,
                data.get("category", "Work"),
                status,
                data.get("due_date"),
                g.user_id,
                data.get("project_id"),
                assigned_to,
            ),
        )
        conn.commit()
        cursor.execute(
            """
            SELECT tasks.*, users.name AS assigned_user
            FROM tasks
            LEFT JOIN users ON tasks.assigned_to = users.id
            WHERE tasks.id=%s
            """,
            (cursor.lastrowid,),
        )
        return jsonify(cursor.fetchone()), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks/<int:id>", methods=["PUT"])
@require_auth
def update_task(id):
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Get old status and check permissions
        cursor.execute(
            """
            SELECT 
                tasks.status,
                tasks.assigned_to, 
                IFNULL(projects.group_id, creator.group_id) AS task_group_id
            FROM tasks
            LEFT JOIN projects ON tasks.project_id = projects.id
            JOIN users creator ON tasks.created_by = creator.id
            WHERE tasks.id=%s
            """,
            (id,),
        )
        task_row = cursor.fetchone()
        if not task_row:
            return jsonify({"error": "Task not found"}), 404
        
        task_group_id = task_row["task_group_id"]
        assigned_to_user = task_row["assigned_to"]
        old_status = task_row["status"]

        # Ensure the user belongs to the task's workspace group
        if task_group_id != g.group_id:
            return jsonify({"error": "Task not found or not in your workspace"}), 404
        
        # Check permissions: only admin of this group or the assigned member
        is_admin = (g.role == "admin" and g.group_id == task_group_id)
        is_assigned = (assigned_to_user is not None and int(assigned_to_user) == g.user_id)
        if not is_admin and not is_assigned:
            return jsonify({"error": "Not authorized to update this task"}), 403

        # Status-only update
        if list(data.keys()) == ["status"]:
            status = data["status"]
            if status not in VALID_STATUSES:
                return jsonify({"error": f"status must be one of {sorted(VALID_STATUSES)}"}), 400
            cursor.execute("UPDATE tasks SET status=%s WHERE id=%s", (status, id))
        else:
            err = validate_fields(data, ["title"])
            if err:
                return jsonify({"error": err}), 400
            priority = data.get("priority", "Medium")
            status = data.get("status", "todo")
            assigned_to = data.get("assigned_to")
            if assigned_to == "":
                assigned_to = None
            if priority not in VALID_PRIORITIES:
                return jsonify({"error": f"priority must be one of {sorted(VALID_PRIORITIES)}"}), 400
            if status not in VALID_STATUSES:
                return jsonify({"error": f"status must be one of {sorted(VALID_STATUSES)}"}), 400
            cursor.execute(
                """
                UPDATE tasks
                SET title=%s, description=%s, priority=%s, category=%s, status=%s, due_date=%s, assigned_to=%s
                WHERE id=%s
                """,
                (
                    data["title"].strip(),
                    data.get("description", ""),
                    priority,
                    data.get("category", "Work"),
                    status,
                    data.get("due_date"),
                    assigned_to,
                    id,
                ),
            )

        conn.commit()

        # Log status change activity
        if old_status and old_status != status:
            cursor.execute(
                """
                INSERT INTO task_activities (task_id, user_id, activity_type, content)
                VALUES (%s, %s, 'status_change', %s)
                """,
                (id, g.user_id, f"Changed status from '{old_status}' to '{status}'")
            )
            conn.commit()
        cursor.execute(
            """
            SELECT 
                tasks.*, 
                users.name AS assigned_user,
                la.content AS latest_activity_content,
                la.activity_type AS latest_activity_type,
                la.user_name AS latest_activity_user_name
            FROM tasks
            LEFT JOIN users ON tasks.assigned_to = users.id
            LEFT JOIN (
                SELECT ta1.task_id, ta1.content, ta1.activity_type, u.name AS user_name
                FROM task_activities ta1
                JOIN users u ON ta1.user_id = u.id
                WHERE ta1.activity_type IN ('progress_share', 'work_upload')
                  AND ta1.id = (
                    SELECT MAX(ta2.id) 
                    FROM task_activities ta2 
                    WHERE ta2.task_id = ta1.task_id
                      AND ta2.activity_type IN ('progress_share', 'work_upload')
                )
            ) la ON tasks.id = la.task_id
            WHERE tasks.id=%s
            """,
            (id,),
        )
        updated = cursor.fetchone()
        if not updated:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(updated)
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks/<int:id>", methods=["DELETE"])
@require_auth
def delete_task(id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check task group and permissions
        cursor.execute(
            """
            SELECT 
                IFNULL(projects.group_id, creator.group_id) AS task_group_id
            FROM tasks
            LEFT JOIN projects ON tasks.project_id = projects.id
            JOIN users creator ON tasks.created_by = creator.id
            WHERE tasks.id=%s
            """,
            (id,),
        )
        task_row = cursor.fetchone()
        if not task_row:
            return jsonify({"error": "Task not found"}), 404
        
        task_group_id = task_row["task_group_id"]
        
        # Only admin of the task's workspace group can delete it
        is_admin = (g.role == "admin" and g.group_id == task_group_id)
        if not is_admin:
            return jsonify({"error": "Only admins of this workspace can delete tasks"}), 403
            
        cursor.execute("DELETE FROM tasks WHERE id=%s", (id,))
        conn.commit()
        return jsonify({"message": "Task deleted"})
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks/<int:task_id>/activities", methods=["POST"])
@require_auth
def add_task_activity(task_id):
    activity_type = request.form.get("activity_type", "progress_share")
    content = request.form.get("content", "").strip()
    
    file_path = None
    file_name = None
    
    if "file" in request.files:
        uploaded_file = request.files["file"]
        if uploaded_file and uploaded_file.filename:
            file_name = secure_filename(uploaded_file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{file_name}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            uploaded_file.save(file_path)
            file_path = f"/uploads/{unique_filename}"

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check task group
        cursor.execute(
            """
            SELECT tasks.id FROM tasks 
            LEFT JOIN projects ON tasks.project_id = projects.id 
            WHERE tasks.id = %s AND (projects.group_id = %s OR (tasks.project_id IS NULL AND tasks.created_by IN (SELECT id FROM users WHERE group_id = %s)))
            """,
            (task_id, g.group_id, g.group_id)
        )
        if not cursor.fetchone():
            return jsonify({"error": "Task not found or not in your workspace"}), 404

        if file_path and activity_type == "progress_share":
            activity_type = "work_upload"

        cursor.execute(
            """
            INSERT INTO task_activities (task_id, user_id, activity_type, content, file_path, file_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (task_id, g.user_id, activity_type, content or None, file_path, file_name)
        )
        conn.commit()
        
        return jsonify({"message": "Activity logged successfully"}), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks/<int:task_id>/activities", methods=["GET"])
@require_auth
def get_task_activities(task_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check task group
        cursor.execute(
            """
            SELECT tasks.id FROM tasks 
            LEFT JOIN projects ON tasks.project_id = projects.id 
            WHERE tasks.id = %s AND (projects.group_id = %s OR (tasks.project_id IS NULL AND tasks.created_by IN (SELECT id FROM users WHERE group_id = %s)))
            """,
            (task_id, g.group_id, g.group_id)
        )
        if not cursor.fetchone():
            return jsonify({"error": "Task not found"}), 404

        cursor.execute(
            """
            SELECT ta.*, u.name AS user_name, u.avatar AS user_avatar 
            FROM task_activities ta
            LEFT JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id = %s
            ORDER BY ta.created_at DESC
            """,
            (task_id,)
        )
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/tasks/<int:task_id>/assign", methods=["POST"])
@require_auth
def assign_task(task_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "'user_id' is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        if not can_modify_task(cursor, task_id):
            return jsonify({"error": "Not authorized to modify this task"}), 403
        cursor.execute(
            "INSERT IGNORE INTO task_assignments (task_id, user_id) VALUES (%s, %s)",
            (task_id, user_id),
        )
        conn.commit()
        return jsonify({"message": "Task assigned"}), 201
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


@app.route("/projects/<int:project_id>/tasks", methods=["GET"])
@require_auth
def get_project_tasks(project_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT tasks.*, users.name AS assigned_user
            FROM tasks
            LEFT JOIN task_assignments ON tasks.id = task_assignments.task_id
            LEFT JOIN users ON users.id = task_assignments.user_id
            WHERE tasks.project_id=%s
            ORDER BY tasks.id DESC
            """,
            (project_id,),
        )
        return jsonify(cursor.fetchall())
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


# =======================
# DASHBOARD
# =======================

@app.route("/dashboard", methods=["GET"])
@require_auth
def dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as total FROM tasks")
        total = cursor.fetchone()["total"]

        cursor.execute("SELECT COUNT(*) as completed FROM tasks WHERE status='completed'")
        completed = cursor.fetchone()["completed"]

        cursor.execute("SELECT COUNT(*) as progress FROM tasks WHERE status='in_progress'")
        progress = cursor.fetchone()["progress"]

        cursor.execute("SELECT COUNT(*) as urgent FROM tasks WHERE priority IN ('Urgent', 'High')")
        urgent = cursor.fetchone()["urgent"]

        return jsonify({
            "total_tasks": total,
            "completed_tasks": completed,
            "in_progress_tasks": progress,
            "urgent_tasks": urgent,
        })
    except Exception as e:
        return server_error(conn, e)
    finally:
        cursor.close()
        conn.close()


# =======================
# GLOBAL ERROR HANDLERS
# =======================

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"error": "Too many requests, please try again later"}), 429


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error"}), 500


# =======================
# RUN SERVER
# =======================

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug)
