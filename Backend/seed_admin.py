from sqlalchemy import or_
from passlib.context import CryptContext

from app.database import SessionLocal, engine, Base
from app.models import Admin

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_admin_if_missing():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(
            (Admin.username == "mau9999") | (Admin.email == "admin@campace.edu")
        ).first()

        if existing:
            print("Admin already exists:", existing.username)
            return

        hashed = pwd_context.hash("admin123")
        admin = Admin(username="mau9999", email="admin@campace.edu", password=hashed)
        db.add(admin)
        db.commit()
        print("Admin created:", admin.username)
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_if_missing()
