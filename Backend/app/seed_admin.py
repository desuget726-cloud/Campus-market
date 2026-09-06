# C:\xampp\htdocs\Backend\seed_admin.py
from passlib.context import CryptContext
from app.models import Base, Admin
from app.database import engine, SessionLocal

# የ MySQL ማገናኛ ሊንክ (XAMPP MySQL)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_admin():
    print("Connecting to MySQL to seed admin...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # አስተዳዳሪው ቀድሞ መመዝገቡን ማረጋገጫ
        existing = db.query(Admin).filter(Admin.username == "mau9999").first()
        if not existing:
            hashed_password = pwd_context.hash("admin123") # admin123 የሚለውን ቃል ያመጥረዋል
            db_admin = Admin(
                username="mau9999",
                email="admin@campace.com",
                password=hashed_password
            )
            db.add(db_admin)
            db.commit()
            print("Success! Admin 'mau9999' with hashed password successfully registered in 'admins' table! 🎉")
        else:
            print("Admin 'mau9999' already exists in database.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()