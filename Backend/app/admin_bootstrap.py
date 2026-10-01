import json
import os
import secrets

from app.database import Base, SessionLocal
from app.models import Admin, SystemSetting
from app.password_security import hash_password


def get_min_password_length(db):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "security").first()
    try:
        values = json.loads(setting.value) if setting else {}
        return max(1, int(values.get("minPasswordLength", 8)))
    except (AttributeError, TypeError, ValueError):
        return 8


def create_admin_if_missing():
    username = os.getenv("ADMIN_USERNAME", "").strip()
    email = os.getenv("ADMIN_EMAIL", "").strip()
    if not username:
        raise ValueError("ADMIN_USERNAME must be set before creating an admin.")
    if not email:
        raise ValueError("ADMIN_EMAIL must be set before creating an admin.")

    db = None
    try:
        db = SessionLocal()
        Base.metadata.create_all(bind=db.get_bind())

        existing = db.query(Admin).filter(
            (Admin.username == username) | (Admin.email == email)
        ).first()
        if existing:
            disable_two_factor = os.getenv("DISABLE_ADMIN_2FA", "").strip().lower() == "true"
            if disable_two_factor and existing.two_factor_enabled:
                existing.two_factor_enabled = False
                db.commit()
                print(
                    "WARNING: DISABLE_ADMIN_2FA=true; two-factor authentication was disabled "
                    f"for existing admin {existing.username!r}. Unset this variable immediately."
                )
            else:
                print(f"Admin {existing.username!r} already exists; no changes made.")
            return existing

        password = os.getenv("ADMIN_INITIAL_PASSWORD")
        generated_password = not password
        if generated_password:
            password = secrets.token_urlsafe(16)

        minimum_length = get_min_password_length(db)
        if len(password) < minimum_length:
            raise ValueError(
                f"ADMIN_INITIAL_PASSWORD must be at least {minimum_length} characters long."
            )

        admin = Admin(
            username=username,
            email=email,
            full_name="System Administrator",
            password_hash=hash_password(password),
            role="Admin",
            status="Active",
        )
        db.add(admin)
        db.commit()
        print(f"Admin {admin.username!r} created.")
        if generated_password:
            print("Generated ADMIN_INITIAL_PASSWORD (save it now; it will not be shown again):", password)
        return admin
    except Exception:
        if db is not None:
            db.rollback()
        raise
    finally:
        if db is not None:
            db.close()