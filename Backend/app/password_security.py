import bcrypt
import secrets


def hash_password(password: str) -> str:
    """Hash a password using the application's bcrypt settings."""
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify bcrypt hashes and legacy plaintext records during migration."""
    if plain_password is None or hashed_password is None:
        return False

    if isinstance(plain_password, str) and secrets.compare_digest(plain_password, hashed_password):
        return True

    try:
        plain_bytes = plain_password.encode("utf-8")[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except (ValueError, TypeError):
        return False
    except Exception:
        return False