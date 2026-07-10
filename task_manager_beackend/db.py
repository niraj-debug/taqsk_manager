import mysql.connector
from mysql.connector import pooling
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
        "host": os.getenv("DB_HOST"),
        "port": int(os.getenv("DB_PORT", 3306)),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME"),
    }

# Connection pool — reuses connections instead of opening a new one per request
_pool = pooling.MySQLConnectionPool(
    pool_name="task_manager_pool",
    pool_size=int(os.getenv("DB_POOL_SIZE", 2)),
    **db_config
)


def get_db_connection():
    """Return a connection from the pool."""
    return _pool.get_connection()

