from __future__ import annotations
# C:\xampp\htdocs\Backend\app\main.py
from fastapi import FastAPI, Depends, HTTPException, status, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from typing import Optional, List
import shutil
import os
import logging
import httpx
import uuid
import random
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ሁሉንም የዳታቤዝ ሰንጠረዦች (Models) እና ማገናኛዎችን ከሌሎቹ ፋይሎች እንጠራለን
from .models import Student, Category, SubCategory, Product, Admin, Report, Notification, WishlistItem, CartItem, Order, Transaction, PasswordReset
import uuid
from app.models import WishlistItem, CartItem, Order, Transaction, Review
from .database import get_db, init_db


app = FastAPI(title="Campace Backend")

# React ግንኙነት መፍቀጃ (CORS)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create static directory for uploads if it doesn't exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static/uploads")
os.makedirs(STATIC_DIR, exist_ok=True)
AVATAR_DIR = os.path.join(STATIC_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Gmail SMTP configuration - replace with your values
import os

# Read Gmail SMTP credentials from environment (preferred) with sensible defaults
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "your-gmail-address@gmail.com")
# Replace the default below with your 16-character Google App Password (no spaces) or set SENDER_PASSWORD env var
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "abcdefghijklmnop")

# Configure a simple file logger for email/SMTP errors
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
EMAIL_LOG_PATH = os.path.join(LOG_DIR, "email_errors.log")
email_logger = logging.getLogger("app.email")
if not email_logger.handlers:
    fh = logging.FileHandler(EMAIL_LOG_PATH)
    fh.setLevel(logging.INFO)
    fmt = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    fh.setFormatter(fmt)
    email_logger.addHandler(fh)
    email_logger.setLevel(logging.INFO)


def send_otp_email(receiver_email: str, otp: str) -> bool:
    """Send ONLY the raw 6-digit OTP number as a plain-text email body."""
    try:
        body = str(otp)

        msg = MIMEMultipart()
        msg["Subject"] = "Campace Verification Code"
        msg["From"] = SENDER_EMAIL
        msg["To"] = receiver_email
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())

        return True
    except Exception as e:
        email_logger.exception(f"Failed to send raw OTP email to {receiver_email}: {e}")
        return False

class StudentRegister(BaseModel):
    name: str
    student_id: str
    email: str
    phone: Optional[str] = None # <-- አዲሱ የስልክ ቁጥር መቀበያ እዚህ ጋር ተጨምሯል
    password: str
    college: str
    department: str

# የሎጊን ፎርማት (Pydantic Schema)
class LoginRequest(BaseModel):
    id_or_email: str
    password: str

class StudentProfileUpdate(BaseModel):
    student_id: str
    name: str
    phone: Optional[str] = None
    college: str
    department: str
    password: Optional[str] = None

class NotificationMarkReadRequest(BaseModel):
    student_id: str

# የተማሪ ድጋፍ እና ቅሬታ ፎርማት (Pydantic Schema)
class ReportCreate(BaseModel):
    student_id: str
    student_name: str
    issue: str

class WishlistCreate(BaseModel):
    student_id: str
    product_id: int

# የቅሬታ ማሻሻያ/መዝጊያ ፎርማት (Pydantic Schema)
class ReportUpdate(BaseModel):
    status: str

# የአስተዳዳሪ የስርዓት ቅንብሮች ማሻሻያ ፎርማት
class SettingUpdate(BaseModel):
    value: bool

# የተለጠፉ ዕቃዎች ፈጠራ ፎርማት (Pydantic Schema)
class ProductCreate(BaseModel):
    title: str
    category: str
    subcategory: Optional[str] = None
    price: str
    image: Optional[str] = None
    description: Optional[str] = None
    seller: Optional[str] = None

class ProductStatusUpdate(BaseModel):
    status: str

class DepositRequest(BaseModel):
    student_id: str
    amount: float
    email: Optional[str] = None

class CheckoutRequest(BaseModel):
    student_id: str

class AIChatRequest(BaseModel):
    message: str

class ReviewCreate(BaseModel):
    order_id: int
    student_id: str
    rating: int
    comment: str

@app.on_event("startup")
def on_startup():
    try:
        init_db() # ሰንጠረዦቹን በራስ-ሰር ዳታቤዝ ውስጥ ይፈጥራል
    except Exception:
        pass

# 1. የተማሪዎች ምዝገባ ኤፒአይ (POST /api/register)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
def register_student(student_data: StudentRegister, db: Session = Depends(get_db)):
    existing_id = db.query(Student).filter(Student.student_id == student_data.student_id).first()
    if existing_id:
        raise HTTPException(status_code=400, detail="Student ID is already registered.")

    existing_email = db.query(Student).filter(Student.email == student_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_password = pwd_context.hash(student_data.password)

    db_student = Student(
        name=student_data.name,
        student_id=student_data.student_id,
        email=student_data.email,
        phone=student_data.phone,
        password=hashed_password,
        college=student_data.college,
        department=student_data.department,
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)

    return {"message": "Success", "user": {"name": db_student.name, "studentId": db_student.student_id}}


# 2. የጋራ የሎጊን ኤፒአይ ኤንድፖይንት (POST /api/login)
@app.post("/api/login")
def login_user(data: LoginRequest, db: Session = Depends(get_db)):
    # 2.1 መጀመሪያ በአስተዳዳሪ ሰንጠረዥ ይፈትሻል
    admin = db.query(Admin).filter(
        (Admin.username == data.id_or_email) | (Admin.email == data.id_or_email)
    ).first()
    
    if admin and pwd_context.verify(data.password, admin.password):
        return {"role": "admin", "user": {"name": admin.username, "email": admin.email}}

    # 2.2 ካልሆነ በተማሪዎች ሰንጠረዥ ይፈትሻል
    student = db.query(Student).filter(
        (Student.student_id == data.id_or_email) | (Student.email == data.id_or_email)
    ).first()
    
    if student and pwd_context.verify(data.password, student.password):
        return {"role": "student", "user": {"name": student.name, "studentId": student.student_id}}

    raise HTTPException(status_code=400, detail="Invalid ID/Email or Password.")


# 2.1 የተማሪ ፕሮፋይል ፎቶ ማስገባት (POST /api/student/upload-avatar)
@app.post("/api/student/upload-avatar")
async def upload_student_avatar(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    filename = image.filename or ""
    extension = os.path.splitext(filename)[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only image files are allowed: jpg, jpeg, png, webp.")

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Ensure avatar directory exists (safe to call repeatedly)
    os.makedirs(AVATAR_DIR, exist_ok=True)

    # Force the saved filename to use .jpg so the public path is predictable
    avatar_path = os.path.join(AVATAR_DIR, f"{student_id}.jpg")

    try:
        contents = await image.read()
        with open(avatar_path, "wb") as buffer:
            buffer.write(contents)
            buffer.flush()
            os.fsync(buffer.fileno())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save avatar file: {str(e)}")
    finally:
        await image.close()

    image_url = f"http://127.0.0.1:8000/static/uploads/avatars/{student_id}.jpg"
    return {"success": True, "imageUrl": image_url}


@app.put("/api/student/profile")
def update_student_profile(profile: StudentProfileUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == profile.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    student.name = profile.name
    student.phone = profile.phone
    student.college = profile.college
    student.department = profile.department

    if profile.password:
        student.password = pwd_context.hash(profile.password)

    db.commit()
    db.refresh(student)

    return {
        "success": True,
        "user": {
            "name": student.name,
            "studentId": student.student_id,
            "email": student.email,
            "phone": student.phone,
            "college": student.college,
            "department": student.department,
        },
    }


@app.get("/api/student/notifications/unread-count")
def get_unread_notifications_count(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    count = db.query(Notification).filter(
        Notification.student_id == student_id,
        Notification.is_read == False
    ).count()

    return {"unreadCount": count}


@app.post("/api/student/notifications/mark-read")
def mark_notifications_read(request: NotificationMarkReadRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    unread_notifications = db.query(Notification).filter(
        Notification.student_id == request.student_id,
        Notification.is_read == False
    )

    updated_count = unread_notifications.count()
    if updated_count:
        unread_notifications.update({"is_read": True}, synchronize_session="fetch")
        db.commit()

    return {"success": True, "markedReadCount": updated_count}


# 3. የዋና እና የንዑሳን ምድቦች ማውጫ ኤፒአይ (GET /api/categories)
@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    result = []
    for cat in categories:
        category_ads_count = (
            db.query(Product)
            .filter(Product.category == cat.name, Product.status == "Approved")
            .count()
        )

        items = []
        for sub in cat.subcategories:
            subcategory_ads_count = (
                db.query(Product)
                .filter(
                    Product.category == cat.name,
                    Product.subcategory == sub.name,
                    Product.status == "Approved",
                )
                .count()
            )
            items.append({
                "name": sub.name,
                "icon": sub.icon,
                "adsCount": f"{subcategory_ads_count} ads",
            })

        result.append({
            "id": cat.id,
            "name": cat.name,
            "icon": cat.icon,
            "adsCount": f"{category_ads_count} ads",
            "items": items,
        })
    return result


@app.get("/api/locations")
def get_locations():
    """Return a simple list of campus/location names for frontend dropdowns."""
    return [
        "Addis Ababa University",
        "Adama University",
        "Bahir Dar University",
        "Dire Dawa University",
        "Haramaya University",
        "Hawassa University",
        "Jimma University",
        "Mekelle University",
        "Wolaita Sodo University",
        "Wollega University",
        "Debre Birhan University",
        "Debre Markos University",
        "Arba Minch University",
        "Samara University",
        "Assosa University",
        "Kombolcha University"
    ]


# 4. የዕቃዎች ማውጫ እና ማጣሪያ ኤፒአይ (GET /api/products)
@app.get("/api/products")
def get_products(category: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Product)
    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter(
            Product.title.contains(search) | 
            Product.description.contains(search) |
            Product.subcategory.contains(search)
        )
    return query.all()


class ChatInitiateRequest(BaseModel):
    buyer_id: str
    product_id: int


@app.get("/api/products/{product_id}")
def get_product_details(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    seller = None
    if product.seller:
        seller = db.query(Student).filter(
            (Student.student_id == product.seller) | (Student.name == product.seller)
        ).first()

    return {
        "id": product.id,
        "title": product.title,
        "category": product.category,
        "subcategory": product.subcategory,
        "price": product.price,
        "image": product.image,
        "description": product.description,
        "seller": product.seller,
        "seller_name": seller.name if seller else (product.seller or "Verified Seller"),
        "seller_phone": seller.phone if seller else "No phone provided",
        "status": product.status,
        "created_at": product.created_at,
    }


@app.post("/api/student/chat/initiate")
def initiate_chat(request: ChatInitiateRequest, db: Session = Depends(get_db)):
    buyer = db.query(Student).filter(Student.student_id == request.buyer_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer not found")

    product = db.query(Product).filter(Product.id == request.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    seller = None
    if product.seller:
        seller = db.query(Student).filter(
            (Student.student_id == product.seller) | (Student.name == product.seller)
        ).first()

    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    # Prevent notifying yourself
    if buyer.student_id == seller.student_id:
        return {"success": True, "message": "You are the owner of this listing."}

    notification = Notification(
        student_id=seller.student_id,
        message=f"Student {buyer.name} wants to start a chat regarding your item {product.title}."
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {
        "success": True,
        "message": "Chat notification sent to the seller.",
        "notification_id": notification.id,
    }


@app.get("/api/student/listings")
def get_student_listings(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    listings = (
        db.query(Product)
        .filter(
            (Product.seller == student.student_id) | (Product.seller == student.name)
        )
        .order_by(Product.created_at.desc())
        .all()
    )

    return [
        {
            "id": prod.id,
            "title": prod.title,
            "price": prod.price,
            "description": prod.description,
            "image": prod.image,
            "category": prod.category,
            "subcategory": prod.subcategory,
            "seller": prod.seller,
            "status": prod.status,
            "created_at": prod.created_at,
        }
        for prod in listings
    ]


# 21. የሻጭ ስታቲስቲክስ እና የደረሱ ትዕዛዞች መጥሪያ ኤፒአይ (GET /api/student/seller/dashboard-data) - Database-driven
@app.get("/api/student/seller/dashboard-data")
def get_seller_dashboard_data(student_id: str, db: Session = Depends(get_db)):
    """Calculates dynamic stats and fetches received orders on listings owned by the logged-in student."""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    # 1. Query all listings owned by the seller
    total_listings = db.query(Product).filter(
        (Product.seller == student.student_id) | (Product.seller == student.name)
    ).count()

    # 2. Query received orders by joining Order and Product tables
    received_orders = db.query(Order).join(Product, Order.product_id == Product.id).filter(
        (Product.seller == student.student_id) | (Product.seller == student.name)
    ).order_by(Order.created_at.desc()).all()

    # 3. Calculate earnings
    earnings = 0.00
    for order in received_orders:
        cleaned_price = order.price.replace('$', '').replace('ETB', '').replace(',', '').strip()
        try:
            earnings += float(cleaned_price)
        except ValueError:
            pass

    # Return formatted payload
    return {
        "stats": {
            "total_listings": total_listings,
            "total_orders": len(received_orders),
            "earnings": f"${earnings:.2f}",
            "pending_orders": len([o for o in received_orders if o.status.lower() == "processing"])
        },
        "received_orders": [
            {
                "id": o.id,
                "title": o.title,
                "price": o.price,
                "status": o.status,
                "buyer_id": o.student_id,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M")
            }
            for o in received_orders
        ]
    }


# --- 5. የ Jiji-style የዳታቤዝ AI አማካሪ ቻት ኤንድፖይንት (POST /api/ai/chat) ---
@app.post("/api/ai/chat")
def ai_chat(chat_request: AIChatRequest, db: Session = Depends(get_db)):
    message = chat_request.message.strip().lower()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")

    # 5.1 ተጠቃሚው ስለ ላፕቶፕ ወይም ኮምፒውተር ከጠየቀ (Query MySQL for Laptops)
    if "laptop" in message or "computer" in message or "pc" in message:
        db_products = db.query(Product).filter(
            (Product.category.ilike("%electronics%")) | 
            (Product.title.ilike("%laptop%")) | 
            (Product.title.ilike("%computer%"))
        ).limit(3).all()
        
        if db_products:
            reply = "I searched our MySQL database in real-time and found these laptops currently listed by students:\n\n"
            for p in db_products:
                reply += f"📍 **{p.title}** — **{p.price}**\n👤 Seller: {p.seller}\n📝 Description: {p.description[:100]}...\n\n"
            reply += "You can browse these directly under the 'Electronics' directory on your home page!"
        else:
            reply = "I checked our MySQL database, but there are currently no laptops listed by students. You can be the first to list one in the 'Seller Hub'!"
            
    # 5.2 ተጠቃሚው ስለ መማሪያ መጻሕፍት ከጠየቀ (Query MySQL for Books)
    elif "book" in message or "calculus" in message or "textbook" in message or "math" in message:
        db_products = db.query(Product).filter(
            (Product.category.ilike("%books%")) | 
            (Product.title.ilike("%book%")) |
            (Product.title.ilike("%textbook%"))
        ).limit(3).all()
        
        if db_products:
            reply = "Here are the academic textbooks currently listed in our database:\n\n"
            for p in db_products:
                reply += f"📖 **{p.title}** — **{p.price}**\n📝 Description: {p.description[:100]}...\n\n"
        else:
            reply = "I couldn't find any academic books listed in our database at this moment. Graduating students usually upload them soon!"
            
    # 5.3 አጠቃላይ መረጃዎች (Default fallback)
    else:
        reply = (
            "I’m your Campus AI assistant. Ask me about textbooks, gadget pricing, or campus trading tips. "
            "Try questions like ‘Which calculus book should I buy?’ or ‘How much should I sell a laptop for?’"
        )

    return {"reply": reply}


# 4.1. አዲስ ተለጠፈ እቃ በተማሪ ወይም ሻጭ የሚፈጠር ኤፒአይ (POST /api/products)
@app.post("/api/products", status_code=status.HTTP_201_CREATED)
def create_product(
    title: str = Form(...),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    price: str = Form(...),
    description: Optional[str] = Form(None),
    seller: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    ተለጠፈ እቃ ፈጠር - ተማሪ ወይም ሻጭ አዲስ ምርት ሊለጥፉ ይችላሉ።
    ሁሉም ምርቶች በ "Pending" ሁኔታ ይጀምራሉ - ተግባር ሰው እና ይጠብቅ።
    ছবი ገልብጥ - ፋይል ወደ static/uploads ይቀመጡ።
    """
    try:
        image_url = None
        
        # ስዕል ወደ ፋይል ያስቀምጡ (Save image if provided)
        if image and image.filename:
            # Validate file type
            allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
            file_ext = os.path.splitext(image.filename)[1].lower()
            
            if file_ext not in allowed_extensions:
                raise HTTPException(status_code=400, detail="Invalid image format. Allowed: jpg, jpeg, png, gif, webp")
            
            # Create unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_")
            unique_filename = timestamp + image.filename
            file_path = os.path.join(STATIC_DIR, unique_filename)
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            
            # Generate public URL
            image_url = f"http://127.0.0.1:8000/static/uploads/{unique_filename}"
        
        # ምርት ወደ ዳታቤዝ ያስቀምጡ (Save product to database)
        db_product = Product(
            title=title,
            category=category,
            subcategory=subcategory,
            price=price,
            image=image_url,
            description=description,
            seller=seller,
            status="Pending"  # ሁሉም አዲስ ምርቶች "Pending" ሁኔታ ይጀምራሉ
        )
        db_product.location = "Addis Ababa" # default location
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        
        return {
            "success": True,
            "message": "Product posted successfully! Awaiting admin approval.",
            "product": {
                "id": db_product.id,
                "title": db_product.title,
                "image": db_product.image,
                "status": db_product.status,
                "created_at": db_product.created_at
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")


# ==========================================
# --- የተማሪዎች የድጋፍ እና የኖቲፊኬሽን ኤፒአዮች (Student Core API) ---
# ==========================================

# 5. ተማሪዎች አዲስ ቅሬታ ወይም የድጋፍ ፎርም የሚልኩበት ኤፒአይ (POST /api/student/report)
@app.post("/api/student/report", status_code=status.HTTP_201_CREATED)
def create_report(report_data: ReportCreate, db: Session = Depends(get_db)):
    # ሪፖርት የሚያደርገው ተማሪ በዳታቤዝ ውስጥ መኖሩን ያረጋግጣል
    student = db.query(Student).filter(Student.student_id == report_data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found in database.")

    db_report = Report(
        student_id=report_data.student_id,
        student_name=report_data.student_name,
        issue=report_data.issue,
        status="Open"
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return {"message": "Success", "report": db_report}


# 6. ለተማሪው የተላኩትን ኖቲፊኬሽኖች በሙሉ ከዳታቤዝ የሚያወጣ ኤፒአይ (GET /api/student/notifications)
@app.get("/api/student/notifications")
def get_student_notifications(student_id: str, db: Session = Depends(get_db)):
    notifications = db.query(Notification).filter(
        Notification.student_id == student_id
    ).order_by(Notification.created_at.desc()).all()
    return notifications


# 7. የተማሪ ዊሽሊስት የተለጠፈ ኤፒአይ (GET /api/student/wishlist)
@app.get("/api/student/wishlist")
def get_student_wishlist(student_id: str, db: Session = Depends(get_db)):
    wishlist_items = (
        db.query(WishlistItem)
        .filter(WishlistItem.student_id == student_id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )

    result = []
    for item in wishlist_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            continue

        result.append({
            "id": item.id,
            "student_id": item.student_id,
            "product_id": item.product_id,
            "created_at": item.created_at,
            "title": product.title,
            "price": product.price,
            "description": product.description,
            "image": product.image,
            "category": product.category,
            "subcategory": product.subcategory,
            "seller": product.seller,
            "status": product.status,
        })

    return result


# 8. ተማሪ ዊሽሊስት ዉስጥ እቃ ማስገባት (POST /api/student/wishlist)
@app.post("/api/student/wishlist", status_code=status.HTTP_201_CREATED)
def create_wishlist_item(wishlist_data: WishlistCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == wishlist_data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    product = db.query(Product).filter(Product.id == wishlist_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    existing_item = (
        db.query(WishlistItem)
        .filter(
            WishlistItem.student_id == wishlist_data.student_id,
            WishlistItem.product_id == wishlist_data.product_id,
        )
        .first()
    )
    if existing_item:
        raise HTTPException(status_code=400, detail="Product already exists in wishlist.")

    db_item = WishlistItem(
        student_id=student.student_id,
        product_id=product.id,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return {
        "message": "Product added to wishlist.",
        "id": db_item.id,
        "student_id": db_item.student_id,
        "product_id": db_item.product_id,
        "created_at": db_item.created_at,
    }


# 9. ከተማሪዎች ዊሽሊስት እቃ ማስወገድ (DELETE /api/student/wishlist/{id})
@app.delete("/api/student/wishlist/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_item(id: int, db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter(WishlistItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found.")

    db.delete(item)
    db.commit()
    return


# ==========================================
# --- አዳዲሶቹ የአስተዳዳሪ ኤፒአይ ኤንድፖይንቶች (Admin Endpoints) ---
# ==========================================

# 7. የአስተዳዳሪ ስታቲስቲክስ መግለጫ (GET /api/admin/kpis)
@app.get("/api/admin/kpis")
def get_admin_kpis(db: Session = Depends(get_db)):
    total_users = db.query(Student).count()
    active_listings = db.query(Product).count()
    return [
        {"label": "Total Users", "value": f"{total_users}", "change": "+4.7%"},
        {"label": "Active Listings", "value": f"{active_listings}", "change": "+2.1%"},
        {"label": "Total Revenue", "value": "$0.00", "change": "0.0%"},
        {"label": "Pending Reports", "value": "3", "change": "-8.3%"}
    ]

# 8. የተማሪዎች ዝርዝር መጥሪያ (GET /api/admin/users)
@app.get("/api/admin/users")
def get_admin_users(db: Session = Depends(get_db)):
    students = db.query(Student).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "role": "Student",
            "status": "Active"
        }
        for s in students
    ]

# 9. የተማሪን አካውንት ማገጃ/ማስተካከያ (PATCH /api/admin/users/{id})
@app.patch("/api/admin/users/{id}")
def update_user_status(id: int, db: Session = Depends(get_db)):
    return {"message": "User status updated successfully"}

# 10. የተማሪን አካውንት መደምሰሻ (DELETE /api/admin/users/{id})
@app.delete("/api/admin/users/{id}")
def delete_user(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": "User deleted successfully"}

# 11. የተማሪን አካውንት ማገጃ/ማስተካከያ (PATCH /api/admin/users/{id})
@app.patch("/api/admin/users/{id}")
def update_user_status_duplicate(id: int, db: Session = Depends(get_db)):
    return {"message": "User status updated successfully"}

# 12. የተማሪን አካውንት መደምሰሻ (DELETE /api/admin/users/{id})
@app.delete("/api/admin/users/{id}")
def delete_user_duplicate(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": "User deleted successfully"}

# 13. የዕቃዎች ዝርዝር መጥሪያ (GET /api/admin/products)
@app.get("/api/admin/products")
def get_admin_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "seller": p.seller or "Student",
            "category": p.category,
            "status": p.status,
        }
        for p in products
    ]

# 14. የተለጠፈ እቃን ማስተካከያ/ማፅደቂያ (PATCH /api/admin/products/{id})
@app.patch("/api/admin/products/{id}")
def update_product_status(id: int, data: ProductStatusUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = data.status
    db.commit()
    db.refresh(product)
    return {"message": "Product status updated successfully", "product": {"id": product.id, "status": product.status}}

# 15. የተለጠፈ እቃን መደምሰሻ (DELETE /api/admin/products/{id})
@app.delete("/api/admin/products/{id}")
def delete_product_admin(id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}

# 16. የክፍያ ታሪኮች ማውጫ (GET /api/admin/payments)
@app.get("/api/admin/payments")
def get_admin_payments_endpoint():
    return [
        {"id": 1, "tx": "TX-10234", "type": "Payout", "amount": "$240.00", "status": "Successful"},
        {"id": 2, "tx": "TX-10235", "type": "Subscription", "amount": "$9.99", "status": "Successful"},
        {"id": 3, "tx": "TX-10236", "type": "Refund", "amount": "$32.50", "status": "Pending"}
    ]

# 17. የተማሪዎች ቅሬታ ማውጫ (GET /api/admin/reports) — አሁን ከዳታቤዝ ያነባል
@app.get("/api/admin/reports")
def get_admin_reports(db: Session = Depends(get_db)):
    reports = db.query(Report).all()
    return [
        {
            "id": r.id,
            "issue": r.issue,
            "student": r.student_name,
            "status": r.status
        }
        for r in reports
    ]

# 18. የቅሬታ መፍቻ እና አውቶማቲክ ኖቲፊኬሽን መላኪያ (PATCH /api/admin/reports/{id})
@app.patch("/api/admin/reports/{id}")
def resolve_report(id: int, data: ReportUpdate, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = data.status
    db.commit()
    db.refresh(report)

    # አስተዳዳሪው ቅሬታውን ሲዘጋው (Closed ሲያደርገው) በራስ-ሰር ኖቲፊኬሽን ይፈጥራል (Auto-notification logic)
    if data.status.lower() == "closed":
        db_notification = Notification(
            student_id=report.student_id,
            message=f"Your reported issue regarding '{report.issue[:30]}...' has been resolved by the Admin."
        )
        db.add(db_notification)
        db.commit()

    return {"message": "Dispute status updated successfully"}

# 19. የስርዓት ቅንብሮች ማውጫ (GET /api/admin/settings)
@app.get("/api/admin/settings")
def get_admin_settings_endpoint():
    return [
        {"id": 1, "label": "Maintenance Mode", "type": "toggle", "value": False},
        {"id": 2, "label": "Transaction Fee", "type": "text", "value": "2.5%"},
        {"id": 3, "label": "Campus Registration", "type": "text", "value": "Open"}
    ]

# 20. የስርዓት ቅንብርን ማብሪያ/ማጥፊያ (PATCH /api/admin/settings/{id})
@app.patch("/api/admin/settings/{id}")
def update_setting(id: int, data: SettingUpdate):
    return {"message": "Setting updated successfully"}
# ==========================================
# --- የተማሪ ገዢ ክፍሎች የዳታቤዝ ኤፒአዮች (Student Buyer Core APIs) ---
# ==========================================

def _parse_price_duplicate(value: Optional[str]) -> float:
    if value is None:
        return 0.0

    text = str(value).strip()
    if not text:
        return 0.0

    cleaned = text.replace("$", "").replace("ETB", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except (TypeError, ValueError):
        return 0.0


# 1. የተማሪውን የዊሽሊስት እቃዎች ዝርዝር መጥሪያ (GET /api/student/wishlist)
@app.get("/api/student/wishlist_duplicate")
def get_student_wishlist_duplicate(student_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(
            WishlistItem.id,
            WishlistItem.student_id,
            WishlistItem.product_id,
            WishlistItem.created_at,
            Product.title,
            Product.price,
            Product.description,
            Product.image,
            Product.category,
            Product.subcategory,
            Product.seller,
            Product.status,
        )
        .join(Product, WishlistItem.product_id == Product.id)
        .filter(WishlistItem.student_id == student_id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )

    return [
        {
            "id": row.id,
            "student_id": row.student_id,
            "product_id": row.product_id,
            "created_at": row.created_at,
            "title": row.title,
            "price": row.price,
            "description": row.description,
            "image": row.image,
            "category": row.category,
            "subcategory": row.subcategory,
            "seller": row.seller,
            "status": row.status,
        }
        for row in rows
    ]

# 2. የዊሽሊስት እቃን በቀጥታ ወደ ካርት ማዛወሪያ (DELETE /api/student/wishlist/{id})
@app.delete("/api/student/wishlist/{id}_duplicate")
def delete_wishlist_item_duplicate(id: int):
    return {"message": "Item moved successfully"}

# 3. የተማሪውን የካርት እቃዎች ዝርዝር መጥሪያ (GET /api/student/cart)
@app.get("/api/student/cart_duplicate")
def get_student_cart_duplicate(student_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(
            CartItem.id,
            CartItem.student_id,
            CartItem.product_id,
            CartItem.quantity,
            Product.title,
            Product.price,
            Product.description,
            Product.image,
            Product.category,
            Product.subcategory,
            Product.seller,
            Product.status,
        )
        .join(Product, CartItem.product_id == Product.id)
        .filter(CartItem.student_id == student_id)
        .all()
    )

    items = [
        {
            "id": row.id,
            "title": row.title,
            "price": row.price,
            "quantity": row.quantity,
            "description": row.description,
            "image": row.image,
            "category": row.category,
            "subcategory": row.subcategory,
            "seller": row.seller,
            "status": row.status,
        }
        for row in rows
    ]
    return {"items": items}

# 4. አዲስ እቃ ወደ ካርት መመዝገቢያ (POST /api/student/cart)
@app.post("/api/student/cart_duplicate")
def add_to_cart_duplicate(data: CartItemCreate):
    return {"message": "Item added to cart"}

# 5. ክፍያን ፈጽሞ ካርቱን ማጽጃ (POST /api/student/cart/checkout)
@app.post("/api/student/cart/checkout_duplicate")
def checkout_cart_duplicate(data: CheckoutRequest):
    return {"message": "Checkout completed successfully"}

# 6. የተማሪውን የትዕዛዞች ታሪክ መጥሪያ (GET /api/student/orders)
@app.get("/api/student/orders_duplicate")
def get_student_orders_duplicate(student_id: str, db: Session = Depends(get_db)):
    orders = (
        db.query(Order)
        .filter(Order.student_id == student_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    return [
        {
            "id": order.id,
            "title": order.title,
            "status": order.status,
            "price": order.price,
            "created_at": order.created_at,
        }
        for order in orders
    ]

# 7. የተማሪውን የዋሌት ቀሪ ሂሳብ እና ክፍያ መጥሪያ (GET /api/student/payments)
@app.get("/api/student/payments_duplicate")
def get_student_payments_duplicate(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    latest_tx = (
        db.query(Transaction)
        .filter(Transaction.student_id == student_id)
        .order_by(Transaction.created_at.desc())
        .first()
    )

    recent_tx = "No transactions yet"
    if latest_tx:
        recent_tx = latest_tx.description if getattr(latest_tx, "description", None) else f"{latest_tx.type} - {latest_tx.tx_id}"

    return {
        "balance": float(student.wallet_balance),
        "recentTx": recent_tx,
    }

# 8. አጠቃላይ የቤት ገጽ የተማሪ መግለጫዎች መጥሪያ (GET /api/student/highlights)
@app.get("/api/student/highlights_duplicate")
def get_student_highlights_duplicate(student_id: str, db: Session = Depends(get_db)):
    cart_rows = (
        db.query(CartItem, Product)
        .join(Product, CartItem.product_id == Product.id)
        .filter(CartItem.student_id == student_id)
        .all()
    )

    cart_total = 0.0
    for cart_item, product in cart_rows:
        cart_total += _parse_price_duplicate(product.price) * cart_item.quantity

    approved_listing_count = (
        db.query(Product)
        .filter(Product.status.ilike("approved"))
        .count()
    )

    return {
        "cartValue": round(cart_total, 2),
        "approvedListings": approved_listing_count,
    }

# 3.1 የዊሽሊስት እቃዎችን ከዳታቤዝ መጥሪያ (GET /api/student/wishlist) — አሁን ከዳታቤዝ ያነባል
@app.get("/api/student/wishlist_dynamic")
def get_student_wishlist_dynamic(student_id: str, db: Session = Depends(get_db)):
    wish_items = db.query(WishlistItem).filter(WishlistItem.student_id == student_id).all()
    result = []
    for item in wish_items:
        # ምርቱን ከ products ሰንጠረዥ ጋር ያገናኘዋል
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            result.append({"id": item.id, "product_id": prod.id, "title": prod.title, "price": prod.price})
    return result

# 3.2 የካርት እቃዎችን ከዳታቤዝ መጥሪያ (GET /api/student/cart) — አሁን ከዳታቤዝ ያነባል
@app.get("/api/student/cart_dynamic")
def get_student_cart_dynamic(student_id: str, db: Session = Depends(get_db)):
    cart_items = db.query(CartItem).filter(CartItem.student_id == student_id).all()
    result = []
    for item in cart_items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            result.append({"id": item.id, "title": prod.title, "price": prod.price, "quantity": item.quantity})
    return {"items": result}

# 3.3 የካርት እቃዎችን መግዣ እና ዋሌት ቀሪ ሂሳብ መቀነሻ (POST /api/student/cart/checkout) — አሁን ከዳታቤዝ ያነባል
@app.post("/api/student/cart/checkout_dynamic")
def checkout_cart_dynamic(data: CheckoutRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    cart_items = db.query(CartItem).filter(CartItem.student_id == data.student_id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # አጠቃላይ ሂሳቡን ማስላት
    total_price = 0.00
    for item in cart_items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            # የዋጋ ምልክቱን ($ ወይም ETB) በማጥፋት ወደ ቁጥር ይቀይረዋል
            price_val = float(prod.price.replace('$', '').replace('ETB', '').strip())
            total_price += price_val * item.quantity

    # የዋሌት ቀሪ ሂሳብ መፈተሽ
    if float(student.wallet_balance) < total_price:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")

    # 1. የዋሌት ቀሪ ሂሳብን መቀነስ (Deduct Wallet Balance)
    student.wallet_balance = float(student.wallet_balance) - total_price

    # 2. እቃዎቹን ወደ ትዕዛዞች ሰንጠረዥ ማዛወር (Create Orders)
    for item in cart_items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            db_order = Order(
                student_id=data.student_id,
                product_id=prod.id,
                title=prod.title,
                price=prod.price,
                status="Processing"
            )
            db.add(db_order)

    # 3. ክፍያውን በታሪክ ውስጥ መመዝገብ (Log Transaction)
    db_tx = Transaction(
        student_id=data.student_id,
        tx_id=f"TX-{uuid.uuid4().hex[:6].upper()}",
        type="Purchase",
        amount=total_price,
        status="Successful"
    )
    db.add(db_tx)

    # 4. ካርቱን ማጽዳት (Clear Cart)
    for item in cart_items:
        db.delete(item)

    db.commit()
    return {"message": "Checkout successful!"}

# 3.4 የትዕዛዞችን ታሪክ መጥሪያ (GET /api/student/orders) — አሁን ከዳታቤዝ ያነባል
@app.get("/api/student/orders_dynamic")
def get_student_orders_dynamic(student_id: str, db: Session = Depends(get_db)):
    return db.query(Order).filter(Order.student_id == student_id).all()

# 3.5 የዋሌት ቀሪ ሂሳብ እና ክፍያ መጥሪያ (GET /api/student/payments) — አሁን ከዳታቤዝ ያነባል
@app.get("/api/student/payments_dynamic")
def get_student_payments_dynamic(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    recent_tx = db.query(Transaction).filter(Transaction.student_id == student_id).order_by(Transaction.created_at.desc()).first()
    tx_message = "No transactions yet"
    if recent_tx:
        tx_message = f"{recent_tx.type} - {recent_tx.tx_id} - ${recent_tx.amount}"

    return {
        "balance": float(student.wallet_balance),
        "recentTx": tx_message
    }

# 3.6 ለአስተዳዳሪው የኮከብ ደረጃ እና አስተያየት መላኪያ (POST /api/student/reviews) — አሁን ከዳታቤዝ ያነባል
@app.post("/api/student/reviews_dynamic")
def submit_review_dynamic(data: ReviewCreate, db: Session = Depends(get_db)):
    db_review = Review(
        order_id=data.order_id,
        student_id=data.student_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(db_review)
    db.commit()
    return {"message": "Review submitted successfully!"}



class ReviewCreate(BaseModel):
    order_id: int
    student_id: str
    rating: int
    comment: str

class CartItemCreate(BaseModel):
    student_id: str
    product_id: int
