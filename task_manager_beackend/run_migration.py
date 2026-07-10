import mysql.connector
import os
import urllib.parse as urlparse
from dotenv import load_dotenv

load_dotenv()

# Determine database configuration: URL-based vs separate parameters
db_url = os.getenv("DATABASE_URL")
if db_url:
    url = urlparse.urlparse(db_url)
    db_config = {
        "host": url.hostname,
        "port": url.port or 3306,
        "user": urlparse.unquote(url.username) if url.username else None,
        "password": urlparse.unquote(url.password) if url.password else None,
        "database": url.path[1:] if url.path else None,
    }
else:
    db_config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", 3306)),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME", "task_manager"),
    }

def run_migrations():
    print("Connecting to database...")
    try:
        conn = mysql.connector.connect(**db_config)
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return

    cursor = conn.cursor()

    migrations = [
        "ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0",
        "ALTER TABLE users ADD COLUMN verification_token VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME DEFAULT NULL",
        # Automatically verify all existing users so they aren't locked out
        "UPDATE users SET is_verified = 1 WHERE is_verified = 0 OR is_verified IS NULL"
    ]

    for stmt in migrations:
        try:
            print(f"Executing: {stmt}")
            cursor.execute(stmt)
            conn.commit()
        except mysql.connector.Error as err:
            if err.errno == 1060:  # Duplicate column name
                print(f"Column already exists: {err.msg}")
            elif "is_verified" in stmt and err.errno == 1054: # Unknown column (could happen on some updates if logic conflicts)
                print(f"Column issue: {err.msg}")
            else:
                print(f"Database error executing statement: {err.msg}")
                cursor.close()
                conn.close()
                raise err
        except Exception as e:
            print(f"Error executing statement: {e}")
            cursor.close()
            conn.close()
            raise e

    print("Migration completed successfully!")
    cursor.close()
    conn.close()

if __name__ == "__main__":
    run_migrations()
