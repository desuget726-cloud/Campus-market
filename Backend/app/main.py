from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, status, Form, UploadFile, File, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
import bcrypt
from typing import Optional, List, Dict, Tuple
import shutil
import os
import logging
import httpx
import uuid
import random
import json
import traceback
import hashlib
import hmac
import re
from decimal import Decimal
from collections import Counter
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# ሁሉንም የዳታቤዝ ሰንጠረዦች (Models) እና ማገናኛዎችን ከሌሎቹ ፋይሎች እንጠራለን
from .models import Student, Category, SubCategory, Product, Admin, AuditLog, Report, Notification, Message, WishlistItem, CartItem, Order, Transaction, PasswordReset, SystemSetting
import uuid
from app.models import WishlistItem, CartItem, Order, Transaction, Review
from .database import get_db, init_db, SessionLocal, Base, engine


app = FastAPI(title="Campace Backend")

# React ግንኙነት መፍቀጃ (CORS)
origins = [
    "http://localhost:5173",      # ✓ React frontend (dev)
    "http://127.0.0.1:5173",      # ✓ Alternative localhost
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # ✓ Uses origins list
    allow_credentials=True,       # ✓ Allow cookies/auth
    allow_methods=["*"],          # ✓ All HTTP methods
    allow_headers=["*"],          # ✓ All headers
)

# Create static directory for uploads if it doesn't exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static/uploads")
os.makedirs(STATIC_DIR, exist_ok=True)
AVATAR_DIR = os.path.join(STATIC_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")


class ConnectionManager:
    """Track active websocket connections with online status and transaction logging."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.student_sessions: Dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self.logger = logging.getLogger("chat_manager")

    async def connect(self, student_id: str, websocket: WebSocket, student_name: str = None):
        """Register a student connection and log session."""
        await websocket.accept()
        async with self._lock:
            self.active_connections[student_id] = websocket
            self.student_sessions[student_id] = {
                "connected_at": datetime.now(),
                "name": student_name,
                "message_count": 0,
            }
        self.logger.info(f"[CHAT] Student {student_id} connected. Active: {len(self.active_connections)}")

    async def disconnect(self, student_id: str):
        """Unregister a student connection and log session end."""
        session_info = None
        async with self._lock:
            session_info = self.student_sessions.pop(student_id, {})
            self.active_connections.pop(student_id, None)
        
        if session_info:
            duration = datetime.now() - session_info.get("connected_at", datetime.now())
            msg_count = session_info.get("message_count", 0)
            self.logger.info(
                f"[CHAT] Student {student_id} disconnected. Duration: {duration.total_seconds():.2f}s, Messages: {msg_count}"
            )

    async def send_personal_message(self, student_id: str, payload: dict) -> bool:
        """Send message to online student. Returns True if delivered."""
        async with self._lock:
            websocket = self.active_connections.get(student_id)
            if websocket and student_id in self.student_sessions:
                self.student_sessions[student_id]["message_count"] = \
                    self.student_sessions[student_id].get("message_count", 0) + 1

        if websocket is not None:
            try:
                await websocket.send_json(payload)
                self.logger.debug(f"[CHAT] Message delivered to {student_id}")
                return True
            except Exception as e:
                self.logger.error(f"[CHAT ERROR] Failed to send to {student_id}: {str(e)}")
                await self.disconnect(student_id)
                return False
        return False

    def is_online(self, student_id: str) -> bool:
        """Check if a student is currently online."""
        return student_id in self.active_connections
    
    def get_online_count(self) -> int:
        """Return total active connections."""
        return len(self.active_connections)
    
    def get_online_students(self) -> List[str]:
        """Return list of online student IDs."""
        return list(self.active_connections.keys())


manager = ConnectionManager()

# Password hashing helper functions using native bcrypt
def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    Truncates password to 72 bytes to satisfy bcrypt limits.
    """
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against either a bcrypt hash or a legacy plaintext value.
    This allows secure fallback for old test records that stored passwords directly.
    """
    if plain_password is None or hashed_password is None:
        return False

    if isinstance(plain_password, str) and plain_password == hashed_password:
        return True

    try:
        plain_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except (ValueError, TypeError):
        return False
    except Exception:
        return False


def _validate_student_id(db: Session, raw_student_id: Optional[str], *, field_name: str = "student_id") -> str:
    normalized_student_id = str(raw_student_id).strip() if raw_student_id is not None else ""
    if not normalized_student_id:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")

    admin_user = db.query(Admin).filter(
        or_(Admin.username == normalized_student_id, Admin.email == normalized_student_id)
    ).first()
    if admin_user:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Please provide a valid student ID, not an admin username."
        )

    student = db.query(Student).filter(Student.student_id == normalized_student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    return normalized_student_id


def _parse_price_to_etb(raw_value: Optional[object], usd_to_etb: float = 56.0) -> float:
    """Parse product prices from database strings such as '$120', 'ETB 1700', or '1200' into ETB."""
    if raw_value is None:
        return 0.0

    if isinstance(raw_value, Decimal):
        return float(raw_value)
    if isinstance(raw_value, (int, float)):
        return float(raw_value)

    value_text = str(raw_value).strip()
    if not value_text:
        return 0.0

    is_usd = '$' in value_text or value_text.lower().startswith('usd') or 'usd' in value_text.lower()
    cleaned = value_text.replace('ETB', '').replace('Birr', '').replace('USD', '').replace('$', '').replace(',', '').strip()

    try:
        amount = float(cleaned)
    except ValueError:
        match = re.search(r"[-+]?\d*\.?\d+", cleaned)
        if not match:
            return 0.0
        amount = float(match.group(0))

    return amount * usd_to_etb if is_usd else amount


def _tokenize(text: Optional[str]) -> List[str]:
    if not text:
        return []
    return re.findall(r"[a-zA-Z0-9]+", str(text).lower())


def _build_tfidf_vectors(corpus: List[str]) -> Tuple[List[Dict[str, float]], List[str]]:
    """Build a compact TF-IDF model without external libraries using a simple bag-of-words implementation."""
    documents = [
        [token for token in _tokenize(doc)] for doc in corpus if doc and _tokenize(doc)
    ]
    if not documents:
        return [], []

    vocab = sorted({token for document in documents for token in document})
    doc_count = len(documents)
    doc_frequency = {term: 0 for term in vocab}
    for document in documents:
        unique_terms = set(document)
        for term in unique_terms:
            doc_frequency[term] += 1

    idf = {
        term: 1.0 + (float(__import__('math').log((1 + doc_count) / (1 + doc_frequency.get(term, 0)))) + 1.0)
        for term in vocab
    }

    vectors = []
    for document in documents:
        counts = Counter(document)
        doc_total = sum(counts.values()) or 1
        vector = {}
        for term in vocab:
            tf = counts.get(term, 0) / doc_total
            vector[term] = tf * idf.get(term, 1.0)
        vectors.append(vector)

    return vectors, vocab


def _cosine_similarity(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    dot = sum(vec_a.get(term, 0.0) * vec_b.get(term, 0.0) for term in set(vec_a) | set(vec_b))
    norm_a = __import__('math').sqrt(sum(value * value for value in vec_a.values()))
    norm_b = __import__('math').sqrt(sum(value * value for value in vec_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _student_interest_text(student: Student, db: Session) -> str:
    dept_terms = _tokenize(student.department) + _tokenize(student.college)
    history_tokens = []

    for model in (WishlistItem, CartItem, Order):
        if model == WishlistItem:
            rows = db.query(WishlistItem).filter(WishlistItem.student_id == student.student_id).all()
        elif model == CartItem:
            rows = db.query(CartItem).filter(CartItem.student_id == student.student_id).all()
        else:
            rows = db.query(Order).filter(Order.student_id == student.student_id).all()

        for row in rows:
            product = None
            if model == WishlistItem:
                product = db.query(Product).filter(Product.id == row.product_id).first()
            elif model == CartItem:
                product = db.query(Product).filter(Product.id == row.product_id).first()
            else:
                product = db.query(Product).filter(Product.id == row.product_id).first()

            if product:
                history_tokens.extend(_tokenize(product.title))
                history_tokens.extend(_tokenize(product.category))
                history_tokens.extend(_tokenize(product.subcategory))
                history_tokens.extend(_tokenize(product.description))

    return " ".join(dept_terms + history_tokens)


def _normalize_payment_type(raw_value: Optional[str]) -> str:
    if not raw_value:
        return "Product Purchase"

    value = str(raw_value).strip().lower()
    if not value:
        return "Product Purchase"

    mapping = {
        "product purchase": "Product Purchase",
        "purchase": "Product Purchase",
        "checkout": "Product Purchase",
        "wallet deposit": "Wallet Deposit",
        "deposit": "Wallet Deposit",
        "wallet": "Wallet Deposit",
        "seller payout": "Seller Payout",
        "payout": "Seller Payout",
        "refund": "Refund",
        "reversal": "Refund",
    }
    return mapping.get(value, value.title())


def _normalize_order_status(raw_value: Optional[str]) -> str:
    if raw_value is None:
        return "Pending"
    value = str(raw_value).strip()
    if not value:
        return "Pending"

    normalized = value.lower()
    aliases = {
        "pending": "Pending",
        "processing": "Processing",
        "ready for pickup": "Ready for Pickup",
        "ready_for_pickup": "Ready for Pickup",
        "pickup": "Ready for Pickup",
        "out for delivery": "Out for Delivery",
        "out_for_delivery": "Out for Delivery",
        "delivery": "Out for Delivery",
        "completed": "Completed",
        "success": "Completed",
        "successful": "Completed",
        "cancelled": "Cancelled",
        "canceled": "Cancelled",
        "returned": "Returned",
    }
    return aliases.get(normalized, value.title())


def _normalize_payment_status(raw_value: Optional[str]) -> str:
    if raw_value is None:
        return "Pending"
    value = str(raw_value).strip()
    if not value:
        return "Pending"

    normalized = value.lower()
    aliases = {
        "pending": "Pending",
        "processing": "Pending",
        "success": "Successful",
        "successful": "Successful",
        "paid": "Successful",
        "completed": "Successful",
        "failed": "Failed",
        "cancelled": "Failed",
        "canceled": "Failed",
        "refunded": "Refunded",
        "refund": "Refunded",
    }
    return aliases.get(normalized, value.title())


def _compute_chapa_signature(secret: str, payload: dict) -> str:
    raw = (
        f"{payload.get('tx_ref', '')}:{payload.get('status', '')}:"
        f"{payload.get('amount', '')}:{payload.get('currency', '')}"
    )
    return hmac.new(secret.encode('utf-8'), raw.encode('utf-8'), hashlib.sha256).hexdigest()


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


def send_verification_status_email(receiver_email: str, status: str, reason: Optional[str] = None) -> bool:
    """Send a plain-text email summarizing the verification decision."""
    try:
        if not receiver_email:
            return False

        body_lines = [
            "Campus Marketplace Verification Update",
            f"Status: {status}",
        ]
        if reason:
            body_lines.append(f"Reason: {reason}")

        msg = MIMEMultipart()
        msg["Subject"] = "Campus Marketplace Verification Update"
        msg["From"] = SENDER_EMAIL
        msg["To"] = receiver_email
        msg.attach(MIMEText("\n".join(body_lines), "plain"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())

        return True
    except Exception as e:
        email_logger.exception(f"Failed to send verification email to {receiver_email}: {e}")
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

class NotificationCreate(BaseModel):
    student_id: str
    title: Optional[str] = None
    message: str
    type: str = "system"

class SendMessageRequest(BaseModel):
    sender_id: str
    receiver_id: str
    product_id: Optional[int] = None
    message_text: str

class VerificationDecisionRequest(BaseModel):
    status: str
    reason: Optional[str] = None

class UserStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None

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

DEFAULT_SYSTEM_SETTINGS = {
    "marketplaceName": "Campace Market",
    "description": "A secure campus marketplace for buying and selling university essentials.",
    "supportEmail": "support@campace.edu.et",
    "currency": "ETB",
    "timezone": "Africa/Addis_Ababa",
    "maxImageSize": "5MB",
    "maxImagesPerProduct": 5,
    "requireApproval": True,
    "allowEditing": True,
    "autoHideSold": True,
    "recommendationEngine": "Content-Based Filtering (TF-IDF)",
    "numRecommendations": 5,
    "minSimilarityScore": 0.20,
    "enableAI": True,
    "paymentProvider": "Chapa",
    "enableOnlinePayment": True,
    "paymentVerification": "Automatic",
    "refundsEnabled": True,
    "emailNotifs": True,
    "orderNotifs": True,
    "messageNotifs": True,
    "approvalNotifs": True,
    "paymentNotifs": True,
    "announcementNotifs": True,
    "requireStudentVerification": True,
    "admin2FA": True,
    "maxLoginAttempts": 5,
    "sessionTimeout": 30,
    "minPasswordLength": 8,
    "auditLogging": True,
    "allowedEmailDomain": "university.edu.et",
    "requireUniversityEmail": True,
    "autoApproveStudents": False,
    "autoHideReported": True,
    "requireAdminApproval": True,
    "maxReportsBeforeReview": 3,
    "allowStudentReports": True,
}


def _seed_default_system_settings(db: Session) -> None:
    existing = db.query(SystemSetting).count()
    if existing > 0:
        return

    for key, value in DEFAULT_SYSTEM_SETTINGS.items():
        db.add(SystemSetting(key=key, value=json.dumps(value, ensure_ascii=False)))

    db.commit()


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
    reason: Optional[str] = None

class DepositRequest(BaseModel):
    student_id: str
    amount: float
    email: Optional[str] = None

class CheckoutRequest(BaseModel):
    student_id: str

class AIChatRequest(BaseModel):
    message: str

class AIAdvisorRequest(BaseModel):
    message: str
    student_id: Optional[str] = None
    department: Optional[str] = None
    context: Optional[str] = "general"  # 'academic_defense', 'general', etc.

class ReviewCreate(BaseModel):
    order_id: int
    student_id: str
    rating: int
    comment: str

def ensure_database_compatibility(db: Session) -> None:
    """Add backward-compatible columns when the local MySQL schema is older than the app model."""
    try:
        admin_column = db.execute(text("SHOW COLUMNS FROM admins LIKE 'two_factor_enabled'"))
        if admin_column.fetchone() is None:
            db.execute(text("ALTER TABLE admins ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE"))

        for column_name, definition in {
            "pickup_location": "VARCHAR(255) NOT NULL DEFAULT 'Student Center'",
            "payment_status": "VARCHAR(50) NOT NULL DEFAULT 'Successful'",
            "reviewed": "BOOLEAN NOT NULL DEFAULT FALSE",
        }.items():
            column = db.execute(text(f"SHOW COLUMNS FROM orders LIKE '{column_name}'"))
            if column.fetchone() is None:
                db.execute(text(f"ALTER TABLE orders ADD COLUMN {column_name} {definition}"))

        db.commit()
    except Exception:
        db.rollback()
        traceback.print_exc()


@app.on_event("startup")
def on_startup():
    try:
        init_db()
        db = SessionLocal()
        try:
            ensure_database_compatibility(db)
            _seed_default_system_settings(db)
        finally:
            db.close()
    except Exception:
        traceback.print_exc()

# 1. የተማሪዎች ምዝገባ ኤፒአይ (POST /api/register)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
def register_student(student_data: StudentRegister, db: Session = Depends(get_db)):
    existing_id = db.query(Student).filter(Student.student_id == student_data.student_id).first()
    if existing_id:
        raise HTTPException(status_code=400, detail="Student ID is already registered.")

    existing_email = db.query(Student).filter(Student.email == student_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_password = hash_password(student_data.password)

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
    
    if admin and verify_password(data.password, admin.password_hash):
        return {"role": "admin", "user": {"name": admin.username, "email": admin.email}}

    # 2.2 ካልሆነ በተማሪዎች ሰንጠረዥ ይፈትሻል
    student = db.query(Student).filter(
        (Student.student_id == data.id_or_email) | (Student.email == data.id_or_email)
    ).first()
    
    if student and verify_password(data.password, student.password):
        return {"role": "student", "user": {"name": student.name, "studentId": student.student_id}}

    raise HTTPException(status_code=400, detail="Invalid ID/Email or Password.")


@app.get("/api/admin/profile")
def get_admin_profile(username: Optional[str] = None, db: Session = Depends(get_db)):
    admin = None
    if username:
        admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        admin = db.query(Admin).order_by(Admin.id.asc()).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin profile not found.")

    total_actions = db.query(AuditLog).filter(AuditLog.admin_id == admin.id).count()
    avatar_filename = f"{admin.username}.jpg"
    avatar_url = f"http://127.0.0.1:8000/static/uploads/avatars/{avatar_filename}"
    if not os.path.exists(os.path.join(AVATAR_DIR, avatar_filename)):
        avatar_url = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"

    return {
        "username": admin.username,
        "email": admin.email,
        "role": admin.role,
        "status": admin.status,
        "last_login": admin.last_login.isoformat() if admin.last_login else datetime.utcnow().isoformat(),
        "total_actions": total_actions,
        "avatarUrl": avatar_url,
        "session_ip": "192.168.10.24",
        "two_factor_enabled": bool(getattr(admin, "two_factor_enabled", True)),
    }


@app.put("/api/admin/profile")
def update_admin_profile(payload: dict, db: Session = Depends(get_db)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Profile payload must be a JSON object.")

    admin = db.query(Admin).order_by(Admin.id.asc()).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin profile not found.")

    username = payload.get("username") or admin.username
    email = payload.get("email") or admin.email
    new_password = payload.get("new_password")
    confirm_password = payload.get("confirm_password")
    current_password = payload.get("current_password")
    two_factor_enabled = payload.get("two_factor_enabled", admin.two_factor_enabled if hasattr(admin, "two_factor_enabled") else True)

    if new_password:
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password is required to update the password.")
        if not verify_password(current_password, admin.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
        if new_password != confirm_password:
            raise HTTPException(status_code=400, detail="New password and confirm password do not match.")
        admin.password_hash = hash_password(new_password)

    admin.two_factor_enabled = bool(two_factor_enabled)

    if username and username != admin.username:
        existing = db.query(Admin).filter(Admin.username == username).first()
        if existing and existing.id != admin.id:
            raise HTTPException(status_code=400, detail="Username is already in use.")
        admin.username = username

    if email and email != admin.email:
        existing = db.query(Admin).filter(Admin.email == email).first()
        if existing and existing.id != admin.id:
            raise HTTPException(status_code=400, detail="Email is already in use.")
        admin.email = email

    admin.last_login = datetime.utcnow()
    db.commit()
    db.refresh(admin)

    db.add(AuditLog(
        admin_id=admin.id,
        action="Admin Profile Updated",
        entity_type="Admin",
        entity_id=admin.id,
        description="Administrator updated personal account information and access settings.",
        status="SUCCESS",
        ip_address="127.0.0.1",
    ))
    db.commit()

    return {
        "success": True,
        "message": "Profile updated successfully",
        "username": admin.username,
        "email": admin.email,
        "two_factor_enabled": bool(two_factor_enabled),
    }


@app.post("/api/admin/upload-avatar")
async def upload_admin_avatar(
    username: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    filename = image.filename or ""
    extension = os.path.splitext(filename)[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only image files are allowed: jpg, jpeg, png, webp.")

    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    avatar_name = f"{admin.username}{extension or '.jpg'}"
    avatar_path = os.path.join(AVATAR_DIR, avatar_name)

    try:
        contents = await image.read()
        with open(avatar_path, "wb") as buffer:
            buffer.write(contents)
            buffer.flush()
            os.fsync(buffer.fileno())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save avatar file: {str(exc)}")
    finally:
        await image.close()

    image_url = f"http://127.0.0.1:8000/static/uploads/avatars/{avatar_name}"
    return {"success": True, "imageUrl": image_url, "avatarUrl": image_url}


@app.get("/api/admin/settings")
def get_admin_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSetting).all()
    response = {}
    for item in settings:
        try:
            parsed = json.loads(item.value)
        except (TypeError, ValueError):
            parsed = item.value
        response[item.key] = parsed
    return response


@app.put("/api/admin/settings")
def update_admin_settings(payload: dict, db: Session = Depends(get_db)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Settings payload must be a JSON object.")

    for key, value in payload.items():
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        serialized = json.dumps(value, ensure_ascii=False)
        if existing:
            existing.value = serialized
        else:
            db.add(SystemSetting(key=key, value=serialized))

    db.commit()

    admin = db.query(Admin).order_by(Admin.id.asc()).first()
    if admin:
        db.add(AuditLog(
            admin_id=admin.id,
            action="System Settings Updated",
            entity_type="Settings",
            entity_id=1,
            description="Admin changed platform configuration settings through the dashboard.",
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))
    db.commit()

    return {"message": "Settings saved successfully", "settings": payload}


@app.get("/api/admin/audit-logs")
def get_admin_audit_logs(
    search: Optional[str] = None,
    action_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    try:
        query = db.query(AuditLog).outerjoin(Admin, AuditLog.admin_id == Admin.id)

        if search and search.strip():
            like_value = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    AuditLog.action.ilike(like_value),
                    AuditLog.description.ilike(like_value),
                    Admin.username.ilike(like_value),
                )
            )

        if action_type and action_type.strip().lower() != "all":
            normalized = action_type.strip().lower()
            if normalized in {"login", "logins"}:
                query = query.filter(AuditLog.action.ilike("%login%"))
            elif normalized in {"approval", "approvals"}:
                query = query.filter(AuditLog.action.ilike("%approved%") | AuditLog.action.ilike("%approval%") | AuditLog.action.ilike("%approve%"))
            elif normalized in {"suspension", "suspensions"}:
                query = query.filter(AuditLog.action.ilike("%suspend%") | AuditLog.action.ilike("%suspension%"))
            elif normalized in {"deletion", "deletions"}:
                query = query.filter(AuditLog.action.ilike("%delete%") | AuditLog.action.ilike("%deletion%"))
            else:
                query = query.filter(AuditLog.action.ilike(f"%{normalized}%"))

        if status and status.strip().lower() != "all":
            query = query.filter(AuditLog.status.ilike(f"%{status.strip()}%"))

        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

        results = []
        for log in logs:
            action_label = log.action or "System Event"
            status_value = (log.status or "SUCCESS").upper()
            severity = "success" if status_value == "SUCCESS" else "warning" if status_value in {"WARNING", "PENDING"} else "critical"
            performed_by = "System"
            if log.admin_id:
                admin_query = db.query(Admin.username).filter(Admin.id == log.admin_id).first()
                if admin_query:
                    performed_by = admin_query[0]

            results.append({
                "id": log.id,
                "action": action_label,
                "actionType": (
                    "Logins" if "login" in action_label.lower()
                    else "Approvals" if "approve" in action_label.lower() or "approval" in action_label.lower()
                    else "Suspensions" if "suspend" in action_label.lower() or "suspension" in action_label.lower()
                    else "Deletions" if "delete" in action_label.lower() or "deletion" in action_label.lower()
                    else "System"
                ),
                "description": log.description or "No additional description provided.",
                "performed_by": performed_by,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "ip_address": log.ip_address or "Unknown",
                "date_time": log.created_at.isoformat() if log.created_at else None,
                "status": status_value,
                "severity": severity,
            })

        return results
    except (OperationalError, SQLAlchemyError) as exc:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to load audit logs",
                "detail": str(exc),
                "table": "audit_logs",
                "expected_columns": ["admin_id", "action", "description", "status", "ip_address", "created_at"],
            },
        )
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": "Unexpected error while loading audit logs",
                "detail": str(exc),
            },
        )


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

    validated_student_id = _validate_student_id(db, student_id)
    student = db.query(Student).filter(Student.student_id == validated_student_id).first()
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
        student.password = hash_password(profile.password)

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

    unread_count = (
        db.query(Notification.id)
        .filter(
            Notification.student_id == student_id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {
        "student_id": student_id,
        "unreadCount": unread_count,
        "unread_count": unread_count,
    }


@app.get("/api/student/messages/unread-count")
def get_unread_messages_count(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    unread_messages = (
        db.query(Notification.id)
        .filter(
            Notification.student_id == student_id,
            Notification.is_read.is_(False),
            or_(
                Notification.message.ilike('%chat%'),
                Notification.message.ilike('%message%'),
                Notification.message.ilike('%reply%'),
                Notification.message.ilike('%inbox%')
            )
        )
        .count()
    )

    return {
        "student_id": student_id,
        "unreadCount": unread_messages,
        "unread_count": unread_messages,
    }


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
def get_products(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from sqlalchemy import case, or_

    query = db.query(Product).filter(Product.status == "Approved")

    manual_filters_active = bool(category or subcategory or search)

    if category:
        query = query.filter(Product.category == category)
    if subcategory:
        query = query.filter(Product.subcategory == subcategory)
    if search:
        search_term = search.strip()
        if search_term:
            query = query.filter(
                or_(
                    Product.title.ilike(f"%{search_term}%"),
                    Product.description.ilike(f"%{search_term}%"),
                    Product.subcategory.ilike(f"%{search_term}%"),
                    Product.category.ilike(f"%{search_term}%"),
                )
            )

    if department and not manual_filters_active:
        cleaned_department = re.sub(r"(?i)\bdepartment of\b|\bdept\.?\b|\bdepartment\b", "", department)
        cleaned_department = cleaned_department.replace("(IT)", "").replace("/", " ")
        tokens = [
            token.strip(" ,;:-()[]")
            for token in re.split(r"\s+", cleaned_department)
            if token.strip(" ,;:-()[]") and len(token.strip(" ,;:-()[]")) > 2
        ]
        excluded = {"the", "and", "for", "with", "engineering", "science", "technology", "school", "college"}
        keyword = next((token for token in tokens if token.lower() not in excluded), None)

        if keyword:
            keyword = keyword.strip()
            query = query.order_by(
                case(
                    (Product.title.ilike(f"%{keyword}%"), 0),
                    (Product.description.ilike(f"%{keyword}%"), 0),
                    (Product.category.ilike(f"%{keyword}%"), 0),
                    else_=1,
                ),
                Product.created_at.desc(),
            )
        else:
            query = query.order_by(Product.created_at.desc())
    else:
        query = query.order_by(Product.created_at.desc())

    if limit is not None and not manual_filters_active:
        query = query.limit(limit)

    return query.all()


@app.get("/api/products/{product_id}")
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    """
    Fetch details for a single product by ID.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    return {
        "id": product.id,
        "title": product.title,
        "category": product.category,
        "subcategory": product.subcategory,
        "price": product.price,
        "image": product.image,
        "description": product.description,
        "seller": product.seller,
        "status": product.status,
        "created_at": product.created_at,
    }


class ChatInitiateRequest(BaseModel):
    buyer_id: str
    product_id: int

@app.post("/api/student/chat/initiate")
def initiate_chat(request: ChatInitiateRequest, db: Session = Depends(get_db)):
    buyer_id = _validate_student_id(db, request.buyer_id, field_name="buyer_id")
    buyer = db.query(Student).filter(Student.student_id == buyer_id).first()
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


# ============ AI ADVISOR HELPER FUNCTIONS ============

def detect_intent(message: str) -> str:
    """
    Detect user intent from message:
    - 'buy': Looking for products to purchase
    - 'sell': Asking for pricing/selling advice
    - 'general': General campus questions
    """
    message_lower = message.lower()
    
    # Selling/Pricing intent indicators
    sell_keywords = ['sell', 'price', 'how much', 'worth', 'cost', 'value', 'should i sell', 
                     'selling', 'what price', 'rate', 'negotiat', 'bid', 'offer']
    
    # Buying/Finding intent indicators
    buy_keywords = ['find', 'buy', 'purchase', 'where', 'show', 'list', 'available', 'have', 
                    'get', 'recommend', 'suggest', 'need', 'looking for', 'search']
    
    sell_count = sum(1 for kw in sell_keywords if kw in message_lower)
    buy_count = sum(1 for kw in buy_keywords if kw in message_lower)
    
    if sell_count > buy_count and sell_count > 0:
        return 'sell'
    elif buy_count > 0:
        return 'buy'
    else:
        return 'general'


def extract_keywords(message: str) -> List[str]:
    """Extract product search keywords from message."""
    # Remove common words
    stopwords = {'the', 'a', 'an', 'and', 'or', 'is', 'are', 'for', 'to', 'from', 
                 'in', 'on', 'under', 'over', 'should', 'i', 'me', 'my', 'etb', 
                 'birr', 'how', 'much', 'sell', 'buy', 'find', 'show', 'list'}
    
    # Clean and tokenize
    words = re.findall(r'\b[a-z]+\b', message.lower())
    keywords = [w for w in words if w not in stopwords and len(w) > 2]
    
    return keywords


def calculate_tf_idf_similarity(query: str, products: List[Product]) -> List[Tuple[Product, float]]:
    """
    Calculate TF-IDF similarity between query and product titles/descriptions.
    Returns products sorted by relevance score.
    """
    if not products:
        return []
    
    # Combine title and description for each product
    product_texts = [f"{p.title} {p.description or ''}" for p in products]
    
    # Create TF-IDF vectorizer
    try:
        vectorizer = TfidfVectorizer(lowercase=True, stop_words='english', max_features=100)
        all_texts = [query] + product_texts
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        
        # Calculate cosine similarity with query (first row)
        query_vector = tfidf_matrix[0:1]
        product_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(query_vector, product_vectors)[0]
        
        # Pair products with scores and sort
        scored_products = list(zip(products, similarities))
        scored_products.sort(key=lambda x: x[1], reverse=True)
        
        return scored_products
    except Exception as e:
        logging.error(f"TF-IDF calculation error: {str(e)}")
        # Fallback: return products in original order
        return [(p, 0.5) for p in products]


def search_products_by_intent(db: Session, message: str, intent: str, department: str = None) -> List[Product]:
    """
    Search MySQL database for products matching the user's intent.
    Filter by status='Approved' and optionally by department.
    """
    try:
        keywords = extract_keywords(message)
        
        if not keywords:
            # Generic fallback search
            query = db.query(Product).filter(Product.status == 'Approved')
        else:
            # Build query with keyword matching
            keyword_filters = []
            for keyword in keywords[:5]:  # Limit to 5 keywords
                keyword_filters.append(Product.title.ilike(f"%{keyword}%"))
                keyword_filters.append(Product.description.ilike(f"%{keyword}%"))
                keyword_filters.append(Product.category.ilike(f"%{keyword}%"))
            
            query = db.query(Product).filter(
                Product.status == 'Approved',
                or_(*keyword_filters)
            )
        
        # Department-specific filtering for personalized results
        if department:
            query = query.order_by(Product.created_at.desc())
        else:
            query = query.order_by(Product.created_at.desc())
        
        products = query.limit(20).all()
        
        # Rank by TF-IDF similarity if we have results
        if products and keywords:
            query_text = ' '.join(keywords)
            ranked = calculate_tf_idf_similarity(query_text, products)
            return [p for p, score in ranked if score > 0.1][:10]  # Top 10 relevant
        
        return products[:10]
    except Exception as e:
        logging.error(f"Product search error: {str(e)}")
        return []


def calculate_price_recommendation(db: Session, keywords: List[str]) -> Dict:
    """
    Calculate price recommendation for sellers.
    Search for similar products and calculate average price range.
    """
    try:
        # Search for similar approved/sold products
        similar_products = db.query(Product).filter(
            Product.status.in_(['Approved', 'Sold'])
        ).all()
        
        # Filter by keyword relevance
        if keywords and similar_products:
            scored = calculate_tf_idf_similarity(' '.join(keywords), similar_products)
            similar_products = [p for p, score in scored if score > 0.15][:20]
        
        if not similar_products:
            return {
                "status": "no_data",
                "message": "Not enough similar products in database to calculate recommendation.",
                "suggestion": "Try listing at a competitive price based on product condition and market demand."
            }
        
        # Extract prices
        prices = []
        for p in similar_products:
            if p.price and isinstance(p.price, (int, float, Decimal)):
                prices.append(float(p.price))
        
        if not prices:
            return {"status": "error", "message": "Unable to extract price data."}
        
        # Calculate price statistics
        avg_price = np.mean(prices)
        min_price = np.min(prices)
        max_price = np.max(prices)
        std_dev = np.std(prices)
        
        # Recommend price range (avg ± 10%)
        recommended_low = int(avg_price * 0.85)
        recommended_high = int(avg_price * 1.15)
        
        return {
            "status": "success",
            "recommended_low": recommended_low,
            "recommended_high": recommended_high,
            "average_market_price": int(avg_price),
            "price_range": f"{recommended_low:,} - {recommended_high:,} ETB",
            "market_min": int(min_price),
            "market_max": int(max_price),
            "similar_products_analyzed": len(prices),
            "tips": [
                "✅ Condition matters: Excellent condition justifies higher prices",
                "✅ Demand: High-demand items (laptops, books) sell faster at premium",
                "✅ Timing: Semester start/exams increase demand for study materials",
                "✅ Negotiation: Leave 10-15% room for buyer negotiation",
                f"✅ Competitiveness: Current market average is {int(avg_price):,} ETB"
            ]
        }
    except Exception as e:
        logging.error(f"Price calculation error: {str(e)}")
        return {"status": "error", "message": "Error calculating price recommendation."}


def format_products_for_response(products: List[Product]) -> str:
    """
    Format products as structured string pattern for frontend parsing.
    Returns: "[PRODUCT:id:title:price]" patterns that frontend React app can render.
    """
    if not products:
        return ""
    
    product_cards = []
    for p in products:
        # Format: [PRODUCT:id:title:price]
        product_string = f"[PRODUCT:{p.id}:{p.title}:{p.price}]"
        product_cards.append(product_string)
    
    return "\n".join(product_cards)


# ============ AI ADVISOR ENDPOINT ============

@app.post("/api/ai/advisor")
def ai_advisor(request: AIAdvisorRequest, db: Session = Depends(get_db)):
    """
    Academic Defense AI Advisor endpoint.
    
    Features:
    1. Intent parsing: Detects if user wants to buy/find products or get pricing advice
    2. Product search: MySQL query with TF-IDF/Cosine Similarity relevance ranking
    3. Price advice: Analyzes similar products and recommends price range for sellers
    4. Structured response: Returns products as [PRODUCT:id:title:price] for frontend rendering
    """
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")
    
    logger = logging.getLogger("ai_advisor")
    logger.info(f"[AI ADVISOR] Query from {request.student_id}: {message[:100]}")
    
    try:
        # Step 1: Detect user intent
        intent = detect_intent(message)
        keywords = extract_keywords(message)
        
        logger.debug(f"[AI ADVISOR] Detected intent: {intent}, Keywords: {keywords}")
        
        # Step 2a: BUYING INTENT - Search for products
        if intent == 'buy':
            products = search_products_by_intent(
                db=db,
                message=message,
                intent=intent,
                department=request.department
            )
            
            if products:
                # Format products as structured cards for frontend
                product_cards = format_products_for_response(products)
                
                reply = f"""🔍 **Search Results for Your Query**

I found {len(products)} relevant products in our database that match your request:

{product_cards}

📌 **Tips:**
✅ Check product details and seller ratings before contacting
✅ Ask questions about condition and shipping
✅ Read reviews from other buyers for similar products
✅ Consider timing - semester start usually has better deals!

Would you like recommendations in a specific price range or category?"""
                
                logger.info(f"[AI ADVISOR] Found {len(products)} products for buying intent")
                
                return {
                    "reply": reply,
                    "products": [{"id": p.id, "title": p.title, "price": p.price} for p in products],
                    "intent": intent,
                    "message_type": "product_search"
                }
            else:
                reply = """❌ **No Matching Products Found**

Unfortunately, I didn't find any products matching your search in our current database.

💡 **Suggestions:**
✅ Try searching for similar items (e.g., 'electronics' instead of specific brand)
✅ Be the first to list what you're looking for in the Seller Hub
✅ Check back soon - new listings are added daily!
✅ Browse our categories to discover available options

Would you like suggestions for alternative products or categories?"""
                
                return {
                    "reply": reply,
                    "products": [],
                    "intent": intent,
                    "message_type": "no_results"
                }
        
        # Step 2b: SELLING INTENT - Price advice & tips
        elif intent == 'sell':
            price_data = calculate_price_recommendation(db, keywords)
            
            if price_data["status"] == "success":
                reply = f"""💰 **AI Price Recommendation for Your Sale**

Based on analysis of {price_data['similar_products_analyzed']} similar products in our marketplace:

**📊 Recommended Price Range: {price_data['price_range']}**
- Market Average: {price_data['average_market_price']:,} ETB
- Market Range: {price_data['market_min']:,} - {price_data['market_max']:,} ETB

**🎯 Seller Tips:**
{chr(10).join(price_data['tips'])}

**Pro Tips for Your Listing:**
✅ Take clear, well-lit photos from multiple angles
✅ Write detailed description (condition, age, any defects)
✅ Mention warranty if applicable
✅ Respond quickly to inquiries - speeds up sales
✅ Consider offering delivery options for extra convenience

Ready to list? Head to Seller Hub to post your item! 📱"""
                
                logger.info(f"[AI ADVISOR] Price recommendation: {price_data['recommended_low']}-{price_data['recommended_high']}")
                
                return {
                    "reply": reply,
                    "price_recommendation": price_data,
                    "intent": intent,
                    "message_type": "price_advice"
                }
            else:
                reply = """⚠️ **Unable to Calculate Price Recommendation**

""" + price_data.get("message", "An error occurred.") + """

🔍 **Here's what you can do:**

1. **Check similar products manually** in our marketplace for current pricing
2. **Consider product factors:**
   - Condition (new, like-new, good, fair)
   - Age and usage
   - Market demand (high during semester start/exams)
   - Brand and model popularity
   
3. **Competitive pricing tips:**
   - Be 5-10% below market average to sell faster
   - Price premium only if condition is excellent or brand is highly desired
   - Leave room for negotiation

Ready to list your item? Create a detailed listing in the Seller Hub!"""
                
                return {
                    "reply": reply,
                    "price_recommendation": None,
                    "intent": intent,
                    "message_type": "price_no_data"
                }
        
        # Step 2c: GENERAL - Campus tips & guidance
        else:
            reply = """🎓 **Welcome to Campus AI Advisor!**

I'm here to help with your academic defense preparation and campus marketplace needs.

**What I can help with:**

📚 **Find Study Materials & Books**
- "Find calculus textbooks"
- "Show me CCI programming books"
- "Laptops under 25,000 ETB"

💰 **Pricing & Selling Advice**
- "How much should I sell my Dell laptop for?"
- "Price recommendation for used HP notebook"
- "What's the market rate for textbooks?"

🎯 **Defense Preparation Tips**
- Best study materials for your department
- Recommended resources and tools
- Timeline and budgeting advice

**Try asking:**
- "Find laptops under 25k ETB" → Search our database
- "How much is a used MacBook worth?" → Get price advice
- "Show programming books" → Browse available textbooks
- "Defense tips for Computer Science" → Get expert guidance

How can I help you today? 🚀"""
            
            return {
                "reply": reply,
                "intent": intent,
                "message_type": "general_guidance"
            }
    
    except Exception as e:
        logger.error(f"[AI ADVISOR ERROR] {str(e)}", exc_info=True)
        return {
            "reply": f"⚠️ An error occurred while processing your request: {str(e)}. Please try again in a moment.",
            "intent": "error",
            "message_type": "error"
        }


# 4.1. አዲስ ተለጠፈ እቃ በተማሪ ወይም ሻጭ የሚፈጠር ኤፒአይ (POST /api/products)
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
    validated_student_id = _validate_student_id(db, report_data.student_id)
    student = db.query(Student).filter(Student.student_id == validated_student_id).first()
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
@app.get("/api/student/highlights")
def get_student_highlights(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    cart_rows = (
        db.query(CartItem, Product)
        .join(Product, CartItem.product_id == Product.id)
        .filter(CartItem.student_id == student_id)
        .all()
    )
    cart_total_etb = 0.0
    for cart_item, product in cart_rows:
        try:
            unit_price_etb = _parse_price_to_etb(product.price)
            cart_total_etb += unit_price_etb * int(cart_item.quantity or 1)
        except Exception:
            continue

    wishlist_count = db.query(WishlistItem).filter(WishlistItem.student_id == student_id).count()
    unread_notifications = db.query(Notification).filter(
        Notification.student_id == student_id,
        Notification.is_read.is_(False)
    ).count()
    pending_chat_messages = db.query(Notification).filter(
        Notification.student_id == student_id,
        Notification.is_read.is_(False),
        Notification.message.ilike('%chat%')
    ).count()
    approved_products = db.query(Product).filter(Product.status.ilike('%approved%')).count()

    pending_messages = unread_notifications + pending_chat_messages

    return {
        "student_id": student_id,
        "cartValue": round(cart_total_etb, 2),
        "cart_total_etb": round(cart_total_etb, 2),
        "wishlistCount": wishlist_count,
        "wishlist_count": wishlist_count,
        "unreadNotifications": unread_notifications,
        "unread_notifications": unread_notifications,
        "pendingChatMessages": pending_chat_messages,
        "pending_chat_messages": pending_chat_messages,
        "pendingMessages": pending_messages,
        "pending_messages": pending_messages,
        "aiPicks": min(3, max(approved_products, 0)),
        "latestListings": approved_products,
    }


@app.get("/api/student/recommendations")
def get_student_recommendations(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    approved_products = db.query(Product).filter(Product.status.ilike('%approved%')).all()
    if not approved_products:
        return []

    profile_text = _student_interest_text(student, db)
    product_texts = []
    for product in approved_products:
        product_texts.append(
            " ".join([
                product.title or '',
                product.category or '',
                product.subcategory or '',
                product.description or '',
                product.seller or '',
            ])
        )

    corpus = [profile_text] + product_texts
    vectors, _ = _build_tfidf_vectors(corpus)
    if not vectors:
        return []

    profile_vector = vectors[0]
    scored_products = []
    for idx, product in enumerate(approved_products, start=1):
        similarity = _cosine_similarity(profile_vector, vectors[idx])
        scored_products.append({
            "product": product,
            "score": similarity,
        })

    scored_products.sort(key=lambda item: item["score"], reverse=True)
    best_matches = []
    seen_ids = set()
    for item in scored_products:
        product = item["product"]
        if product.id in seen_ids:
            continue
        seen_ids.add(product.id)
        best_matches.append({
            "id": product.id,
            "title": product.title,
            "description": product.description or 'Popular product recommended for your academic needs.',
            "category": product.category or 'General',
            "price": product.price,
            "image": product.image,
            "match_score": round(item["score"], 4),
            "match": "High match" if item["score"] >= 0.15 else "Recommended",
        })
        if len(best_matches) >= 3:
            break

    if not best_matches:
        for product in approved_products[:3]:
            best_matches.append({
                "id": product.id,
                "title": product.title,
                "description": product.description or 'Popular product recommended for your academic needs.',
                "category": product.category or 'General',
                "price": product.price,
                "image": product.image,
                "match_score": 0.0,
                "match": "Recommended",
            })

    return best_matches


@app.get("/api/student/recent-activity")
def get_student_recent_activity(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    products = db.query(Product).filter(Product.status.ilike('approved')).order_by(Product.created_at.desc()).limit(4).all()

    activity = []
    dept_label = student.department or 'Campus'
    for product in products:
        activity.append({
            "title": f"New {product.category} item listed in {dept_label}",
            "description": f"{product.title} is now available for students to discover and purchase.",
            "time": (product.created_at.strftime('%b %d, %H:%M') if product.created_at else 'Just now'),
        })

    if not activity:
        activity = [
            {"title": "New products listed in CCI Department", "description": "Fresh student listings are now visible in the marketplace.", "time": "Just now"},
            {"title": "Campus textbook exchange is active", "description": "Students are sharing verified course materials and study resources.", "time": "15 min ago"},
            {"title": "AI recommendations refreshed", "description": "Your department-specific suggestions were updated based on recent listings.", "time": "1 hour ago"},
        ]

    return activity


@app.get("/api/student/notifications")
def get_student_notifications(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    notifications = db.query(Notification).filter(
        Notification.student_id == student_id
    ).order_by(Notification.created_at.desc()).all()

    unread_notifications = [
        {
            "id": item.id,
            "student_id": item.student_id,
            "title": item.title,
            "message": item.message,
            "type": item.type,
            "is_read": item.is_read,
            "created_at": item.created_at,
        }
        for item in notifications if not item.is_read
    ]

    all_notifications = [
        {
            "id": item.id,
            "student_id": item.student_id,
            "title": item.title,
            "message": item.message,
            "type": item.type,
            "is_read": item.is_read,
            "created_at": item.created_at,
        }
        for item in notifications
    ]

    return {
        "student_id": student_id,
        "unreadCount": len(unread_notifications),
        "unread_count": len(unread_notifications),
        "unreadNotifications": unread_notifications,
        "unread_notifications": unread_notifications,
        "allNotifications": all_notifications,
        "notifications": all_notifications,
    }


@app.post("/api/student/notifications/mark-all-read")
def mark_all_student_notifications_read(student_id: str, db: Session = Depends(get_db)):
    validated_student_id = _validate_student_id(db, student_id)
    student = db.query(Student).filter(Student.student_id == validated_student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    unread_notifications = db.query(Notification).filter(
        Notification.student_id == student_id,
        Notification.is_read.is_(False),
    ).all()

    for notification in unread_notifications:
        notification.is_read = True

    db.commit()

    return {
        "success": True,
        "student_id": student_id,
        "updatedCount": len(unread_notifications),
        "updated_count": len(unread_notifications),
    }


@app.post("/api/student/notifications")
def create_student_notification(request: NotificationCreate, db: Session = Depends(get_db)):
    validated_student_id = _validate_student_id(db, request.student_id)
    student = db.query(Student).filter(Student.student_id == validated_student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    notification_text = request.message.strip() if request.message and request.message.strip() else "Marketplace update"
    if request.title and request.title.strip():
        notification_text = f"{request.title.strip()}: {notification_text}"

    notification = Notification(
        student_id=request.student_id,
        title=request.title.strip() if request.title and request.title.strip() else None,
        message=notification_text,
        type=request.type or "system",
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return {
        "success": True,
        "message": "Notification created successfully",
        "notification": {
            "id": notification.id,
            "student_id": notification.student_id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "is_read": notification.is_read,
            "created_at": notification.created_at,
        },
    }


@app.get("/api/student/messages/conversations")
def get_student_conversations(student_id: str, db: Session = Depends(get_db)):
    """
    Fetch all unique conversation partners with optimized SQL window functions.
    Returns: sorted list with partner details, last message, unread count.
    """
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
        # Use raw SQL with efficient subqueries for better performance
        query_text = text("""
            SELECT DISTINCT
                CASE 
                    WHEN m.sender_id = :student_id THEN m.receiver_id
                    ELSE m.sender_id
                END as partner_id,
                s.name,
                s.email,
                s.phone,
                s.college,
                s.department,
                (SELECT message_text FROM messages 
                 WHERE (sender_id = :student_id AND receiver_id = s.student_id)
                    OR (sender_id = s.student_id AND receiver_id = :student_id)
                 ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages 
                 WHERE (sender_id = :student_id AND receiver_id = s.student_id)
                    OR (sender_id = s.student_id AND receiver_id = :student_id)
                 ORDER BY created_at DESC LIMIT 1) as last_timestamp,
                (SELECT COUNT(*) FROM messages 
                 WHERE sender_id = s.student_id AND receiver_id = :student_id AND is_read = 0) as unread_count
            FROM messages m
            JOIN students s ON (
                (m.sender_id = :student_id AND m.receiver_id = s.student_id)
                OR (m.sender_id = s.student_id AND m.receiver_id = :student_id)
            )
            WHERE m.sender_id = :student_id OR m.receiver_id = :student_id
            ORDER BY last_timestamp DESC
        """)
        
        results = db.execute(query_text, {"student_id": student_id}).fetchall()
        
        conversations = []
        for row in results:
            partner_id = row[0]
            if not partner_id:
                continue
            
            conversations.append({
                "id": f"conv-{partner_id}",
                "studentId": partner_id,
                "name": row[1] or "Unknown Student",
                "email": row[2] or "",
                "phone": row[3] or "",
                "college": row[4] or "",
                "department": row[5] or "",
                "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
                "status": "online" if manager.is_online(partner_id) else "offline",
                "lastMessage": row[6] or "No messages yet",
                "timestamp": row[7].isoformat() if row[7] else "Just now",
                "unread": int(row[8]) if row[8] else 0,
            })
        
        return {
            "student_id": student_id,
            "conversations": conversations,
            "total": len(conversations),
        }
    except Exception as e:
        logging.error(f"Error fetching conversations for {student_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch conversations.")



@app.get("/api/student/messages/chat-history")
def get_student_chat_history(sender_id: str, receiver_id: str, db: Session = Depends(get_db)):
    """
    Retrieve all messages between two students with product details via outer join.
    Efficiently marks unread messages as read in batch.
    """
    sender = db.query(Student).filter(Student.student_id == sender_id).first()
    receiver = db.query(Student).filter(Student.student_id == receiver_id).first()
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
        from sqlalchemy import or_

        # Fetch all messages with product details in a single efficient query
        chat_messages = (
            db.query(
                Message.id,
                Message.sender_id,
                Message.receiver_id,
                Message.product_id,
                Message.message_text,
                Message.is_read,
                Message.created_at,
                Product.id.label("product_id_actual"),
                Product.title.label("product_title"),
                Product.price.label("product_price"),
                Product.image.label("product_image"),
                Product.category.label("product_category")
            )
            .outerjoin(Product, Message.product_id == Product.id)
            .filter(
                or_(
                    (Message.sender_id == sender_id) & (Message.receiver_id == receiver_id),
                    (Message.sender_id == receiver_id) & (Message.receiver_id == sender_id)
                )
            )
            .order_by(Message.created_at.asc())
            .all()
        )

        # Mark incoming unread messages as read in single batch update
        unread_message_ids = [
            msg[0] for msg in chat_messages
            if msg[2] == sender_id and not msg[5]  # receiver_id == sender_id and not is_read
        ]
        if unread_message_ids:
            db.query(Message).filter(Message.id.in_(unread_message_ids)).update(
                {Message.is_read: True},
                synchronize_session=False
            )
            db.commit()

        # Format response with product details
        formatted_messages = []
        for msg in chat_messages:
            formatted_msg = {
                "id": msg[0],
                "sender_id": msg[1],
                "receiver_id": msg[2],
                "product_id": msg[3],
                "message_text": msg[4],
                "is_read": msg[5],
                "created_at": msg[6].isoformat() if msg[6] else None,
            }
            
            # Add product details if message has product attachment
            if msg[3] and msg[8]:  # product_id and product_title
                formatted_msg["product"] = {
                    "id": msg[3],
                    "title": msg[8],
                    "price": str(msg[9]),
                    "image": msg[10],
                    "category": msg[11],
                }
            
            formatted_messages.append(formatted_msg)

        return {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "messages": formatted_messages,
            "total": len(formatted_messages),
            "unread_marked_read": len(unread_message_ids),
        }
    except Exception as e:
        logging.error(f"Error fetching chat history {sender_id}-{receiver_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history.")


@app.websocket("/api/student/chat/ws/{student_id}")
async def student_chat_websocket(websocket: WebSocket, student_id: str):
    """WebSocket endpoint for real-time P2P messaging with transaction logging and security."""
    db = SessionLocal()
    logger = logging.getLogger("websocket_chat")
    
    try:
        # Validate student exists
        student = db.query(Student).filter(Student.student_id == student_id).first()
        if not student:
            await websocket.close(code=1008, reason="Student not found")
            logger.warning(f"[WS SECURITY] Invalid student_id: {student_id}")
            return

        # Register connection
        await manager.connect(student_id, websocket, student_name=student.name)
        logger.info(f"[WS CONNECT] {student_id} ({student.name}) connected. Online: {manager.get_online_count()}")

        while True:
            # Receive message from client
            raw_payload = await websocket.receive_text()
            
            try:
                payload = json.loads(raw_payload)
            except json.JSONDecodeError as e:
                logger.warning(f"[WS ERROR] Invalid JSON from {student_id}: {str(e)}")
                await websocket.send_json({
                    "success": False,
                    "error": "Invalid JSON. Required: receiver_id, message_text. Optional: product_id"
                })
                continue

            # Extract and validate fields
            receiver_id = payload.get("receiver_id", "").strip()
            message_text = payload.get("message_text", "").strip()
            product_id = payload.get("product_id")

            # Validate required fields
            if not receiver_id:
                await websocket.send_json({"success": False, "error": "receiver_id is required."})
                continue
            
            if not message_text or len(message_text) == 0:
                await websocket.send_json({"success": False, "error": "message_text cannot be empty."})
                continue
            
            if len(message_text) > 5000:
                logger.warning(f"[WS SECURITY] Message too long from {student_id}: {len(message_text)} chars")
                await websocket.send_json({"success": False, "error": "Message exceeds max length (5000)."})
                continue

            # Prevent self-messaging
            if student_id == receiver_id:
                logger.warning(f"[WS SECURITY] Self-message attempt from {student_id}")
                await websocket.send_json({"success": False, "error": "Cannot message yourself."})
                continue

            # Validate receiver
            receiver = db.query(Student).filter(Student.student_id == receiver_id).first()
            if not receiver:
                logger.warning(f"[WS SECURITY] Message to non-existent {receiver_id} from {student_id}")
                await websocket.send_json({"success": False, "error": "Recipient not found."})
                continue

            # Validate product if attached
            if product_id is not None:
                try:
                    product_id = int(product_id)
                    product = db.query(Product).filter(Product.id == product_id).first()
                    if not product:
                        logger.warning(f"[WS] Product {product_id} not found")
                        await websocket.send_json({"success": False, "error": "Product not found."})
                        continue
                except (ValueError, TypeError):
                    product_id = None

            # Save message to database
            try:
                db_message = Message(
                    sender_id=student_id,
                    receiver_id=receiver_id,
                    product_id=product_id,
                    message_text=message_text,
                    is_read=False,
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)
                
                logger.info(
                    f"[MESSAGE SAVED] ID={db_message.id} | {student_id} → {receiver_id} | "
                    f"Product={product_id} | Len={len(message_text)}"
                )
            except Exception as exc:
                db.rollback()
                logger.error(f"[DB ERROR] Failed to save message from {student_id}: {str(exc)}")
                await websocket.send_json({"success": False, "error": "Failed to save message."})
                continue

            # Build response
            chat_payload = {
                "type": "incoming_message",
                "id": db_message.id,
                "sender_id": db_message.sender_id,
                "receiver_id": db_message.receiver_id,
                "product_id": db_message.product_id,
                "message_text": db_message.message_text,
                "is_read": db_message.is_read,
                "created_at": db_message.created_at.isoformat() if hasattr(db_message.created_at, "isoformat") else str(db_message.created_at),
            }

            # Send to recipient if online
            delivered = await manager.send_personal_message(receiver_id, chat_payload)
            
            if delivered:
                logger.info(f"[DELIVERED LIVE] ID={db_message.id} to {receiver_id}")
            else:
                logger.info(f"[QUEUED] ID={db_message.id} for {receiver_id} (offline)")

            # Confirm to sender
            await websocket.send_json({
                "success": True,
                "message": "Message sent",
                "data": chat_payload,
                "delivered_live": delivered,
            })

    except WebSocketDisconnect:
        logger.info(f"[WS DISCONNECT] {student_id} closed connection")
        await manager.disconnect(student_id)
    except Exception as exc:
        logger.error(f"[WS FATAL ERROR] {student_id}: {str(exc)}", exc_info=True)
        try:
            await websocket.send_json({"success": False, "error": "WebSocket error"})
        except Exception:
            pass
        await manager.disconnect(student_id)
    finally:
        if db:
            db.close()
        logger.debug(f"[WS CLEANUP] Closed session for {student_id}")


@app.post("/api/student/messages/send")
def send_student_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    validated_sender_id = _validate_student_id(db, request.sender_id, field_name="sender_id")
    validated_receiver_id = _validate_student_id(db, request.receiver_id, field_name="receiver_id")
    sender = db.query(Student).filter(Student.student_id == validated_sender_id).first()
    receiver = db.query(Student).filter(Student.student_id == validated_receiver_id).first()
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not request.message_text or not request.message_text.strip():
        raise HTTPException(status_code=400, detail="Message text is required.")

    if request.product_id is not None:
        product = db.query(Product).filter(Product.id == request.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")

    existing_incoming_messages = db.query(Message).filter(
        Message.sender_id == request.receiver_id,
        Message.receiver_id == request.sender_id,
        Message.is_read.is_(False),
    ).all()
    for message in existing_incoming_messages:
        message.is_read = True

    chat_message = Message(
        sender_id=request.sender_id,
        receiver_id=request.receiver_id,
        product_id=request.product_id,
        message_text=request.message_text.strip(),
        is_read=False,
    )
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)

    return {
        "success": True,
        "message": "Message sent successfully",
        "chatMessage": {
            "id": chat_message.id,
            "sender_id": chat_message.sender_id,
            "receiver_id": chat_message.receiver_id,
            "product_id": chat_message.product_id,
            "message_text": chat_message.message_text,
            "is_read": chat_message.is_read,
            "created_at": chat_message.created_at,
        },
        "readReceiptUpdated": len(existing_incoming_messages),
        "read_receipt_updated": len(existing_incoming_messages),
    }


def _resolve_pickup_location(db: Session, product: Optional[Product]) -> str:
    if not product:
        return "Student Center"

    combined_text = f"{product.category or ''} {product.subcategory or ''} {product.title or ''}".lower()
    if any(token in combined_text for token in ["book", "textbook", "course", "study", "notebook"]):
        return "Campus Bookstore"
    if any(token in combined_text for token in ["phone", "laptop", "computer", "tablet", "device", "electronic", "gadget"]):
        return "ICT Service Desk"
    if any(token in combined_text for token in ["lab", "science", "equipment", "instrument", "chemistry", "biology", "physics"]):
        return "Science Block Store"
    if any(token in combined_text for token in ["bag", "clothes", "shoe", "fashion", "accessory"]):
        return "Student Center"
    return "Student Center"


def _build_order_timeline(order_status: Optional[str], pickup_location: str) -> List[Dict[str, object]]:
    normalized = _normalize_order_status(order_status)
    steps = [
        "Order Placed",
        "Processing",
        f"Ready for Pickup at {pickup_location}",
        "Completed",
    ]

    index_map = {
        "Pending": 0,
        "Order Placed": 0,
        "Processing": 1,
        "Ready for Pickup": 2,
        "Out for Delivery": 2,
        "Completed": 3,
    }

    current_index = index_map.get(normalized, 0)
    timeline = []
    for i, step in enumerate(steps):
        timeline.append({
            "label": step,
            "completed": i <= current_index,
            "current": i == current_index,
        })
    return timeline


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


@app.get("/api/student/cart")
def get_student_cart(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    cart_items = (
        db.query(CartItem)
        .filter(CartItem.student_id == student_id)
        .order_by(CartItem.created_at.desc())
        .all()
    )

    items = []
    total_quantity = 0
    for item in cart_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            continue

        quantity = int(item.quantity or 1)
        total_quantity += quantity
        items.append({
            "id": item.id,
            "student_id": item.student_id,
            "product_id": item.product_id,
            "quantity": quantity,
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

    wishlist_item_count = db.query(WishlistItem).filter(WishlistItem.student_id == student_id).count()
    meta = {
        "cart_item_count": total_quantity,
        "wishlist_item_count": wishlist_item_count,
        "cart_count": total_quantity,
        "wishlist_count": wishlist_item_count,
        "total_items": total_quantity,
    }

    return {"items": items, "meta": meta}


@app.post("/api/student/cart")
def add_to_cart(data: CartItemCreate, db: Session = Depends(get_db)):
    raw_student_id = data.student_id
    normalized_student_id = str(raw_student_id).strip() if raw_student_id is not None else ""

    if not normalized_student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")

    admin_user = db.query(Admin).filter(
        or_(Admin.username == normalized_student_id, Admin.email == normalized_student_id)
    ).first()
    if admin_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid student_id. Please provide a valid student ID, not an admin username."
        )

    student = db.query(Student).filter(Student.student_id == normalized_student_id).first()
    if not student:
        raise HTTPException(
            status_code=400,
            detail="Invalid student_id. The student does not exist in the students table."
        )

    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    existing_cart_item = (
        db.query(CartItem)
        .filter(
            CartItem.student_id == normalized_student_id,
            CartItem.product_id == data.product_id,
        )
        .first()
    )
    wishlist_item = (
        db.query(WishlistItem)
        .filter(
            WishlistItem.student_id == normalized_student_id,
            WishlistItem.product_id == data.product_id,
        )
        .first()
    )

    moved_from_wishlist = False
    message = "Item added to cart."

    try:
        if wishlist_item:
            if existing_cart_item:
                existing_cart_item.quantity = (existing_cart_item.quantity or 1) + 1
                cart_item = existing_cart_item
            else:
                cart_item = CartItem(
                    student_id=data.student_id,
                    product_id=data.product_id,
                    quantity=1,
                )
                db.add(cart_item)

            db.delete(wishlist_item)
            db.commit()
            db.refresh(cart_item)
            moved_from_wishlist = True
            message = "Item moved from wishlist to cart."
        else:
            if existing_cart_item:
                existing_cart_item.quantity = (existing_cart_item.quantity or 1) + 1
                cart_item = existing_cart_item
                db.commit()
                db.refresh(cart_item)
                message = "Cart quantity updated."
            else:
                cart_item = CartItem(
                    student_id=data.student_id,
                    product_id=data.product_id,
                    quantity=1,
                )
                db.add(cart_item)
                db.commit()
                db.refresh(cart_item)
                message = "Item added to cart."
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not update cart.")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Unexpected error while updating cart.")

    cart_count = db.query(CartItem).filter(CartItem.student_id == data.student_id).count()
    wishlist_count = db.query(WishlistItem).filter(WishlistItem.student_id == data.student_id).count()

    return {
        "message": message,
        "moved_from_wishlist": moved_from_wishlist,
        "item": {
            "id": cart_item.id,
            "student_id": cart_item.student_id,
            "product_id": cart_item.product_id,
            "quantity": cart_item.quantity,
        },
        "cart_count": cart_count,
        "wishlist_count": wishlist_count,
        "cart_item_count": cart_count,
        "wishlist_item_count": wishlist_count,
        "meta": {
            "cart_count": cart_count,
            "wishlist_count": wishlist_count,
        },
    }


@app.put("/api/student/cart/{item_id}/quantity")
def update_student_cart_item_quantity(item_id: int, payload: CartItemQuantityUpdate, db: Session = Depends(get_db)):
    new_quantity = payload.quantity
    if new_quantity is None:
        raise HTTPException(status_code=400, detail="quantity is required.")

    try:
        new_quantity = int(new_quantity)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="quantity must be an integer.")

    cart_item = db.query(CartItem).filter(CartItem.id == item_id).first()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found.")

    if new_quantity <= 0:
        db.delete(cart_item)
        db.commit()
        return {
            "message": "Cart item removed.",
            "deleted": True,
            "item": {
                "id": cart_item.id,
                "student_id": cart_item.student_id,
                "product_id": cart_item.product_id,
                "quantity": 0,
            },
        }

    cart_item.quantity = new_quantity
    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Cart item quantity updated.",
        "deleted": False,
        "item": {
            "id": cart_item.id,
            "student_id": cart_item.student_id,
            "product_id": cart_item.product_id,
            "quantity": cart_item.quantity,
        },
    }


@app.post("/api/student/cart/checkout")
def checkout_student_cart(data: CheckoutRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    cart_items = db.query(CartItem).filter(CartItem.student_id == data.student_id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty.")

    cart_total = Decimal("0.00")
    order_payload = []

    for cart_item in cart_items:
        product = db.query(Product).filter(Product.id == cart_item.product_id).first()
        if not product:
            continue

        unit_price_etb = Decimal(str(_parse_price_to_etb(product.price)))
        cart_total += unit_price_etb * Decimal(int(cart_item.quantity or 1))

    current_wallet_balance = Decimal(str(student.wallet_balance or 0))
    if current_wallet_balance < cart_total:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance.")

    student.wallet_balance = current_wallet_balance - cart_total

    for cart_item in cart_items:
        product = db.query(Product).filter(Product.id == cart_item.product_id).first()
        if not product:
            continue

        order = Order(
            student_id=data.student_id,
            product_id=product.id,
            title=product.title,
            price=product.price,
            status="Processing",
        )
        db.add(order)
        db.flush()
        order_payload.append({
            "id": order.id,
            "student_id": order.student_id,
            "product_id": order.product_id,
            "title": order.title,
            "status": order.status,
            "price": order.price,
        })

    tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
    transaction = Transaction(
        student_id=data.student_id,
        tx_id=tx_id,
        type="Purchase",
        amount=cart_total,
        description="Cart checkout",
        status="Successful",
    )
    db.add(transaction)

    for cart_item in cart_items:
        db.delete(cart_item)

    db.commit()

    return {
        "message": "Checkout successful.",
        "total": float(cart_total),
        "wallet_balance": float(student.wallet_balance),
        "orders": order_payload,
    }


@app.get("/api/student/orders")
def get_student_orders(student_id: str, db: Session = Depends(get_db)):
    _validate_student_id(db, student_id, field_name="student_id")

    rows = db.execute(text("""
        SELECT
            o.id,
            o.student_id,
            o.product_id,
            o.title,
            o.price,
            o.status,
            o.created_at,
            COALESCE(o.pickup_location, '') AS pickup_location,
            COALESCE(o.payment_status, 'Successful') AS payment_status,
            COALESCE(o.reviewed, FALSE) AS reviewed
        FROM orders o
        WHERE o.student_id = :student_id
        ORDER BY o.created_at DESC
    """), {"student_id": student_id}).mappings().all()

    result = []
    for row in rows:
        product = db.query(Product).filter(Product.id == row["product_id"]).first()
        pickup_location = (row["pickup_location"] or "").strip() or _resolve_pickup_location(db, product)
        payment_status = _normalize_payment_status(row["payment_status"] or "Successful")
        seller_name = product.seller if product and product.seller else "Campus Seller"

        result.append({
            "id": row["id"],
            "student_id": row["student_id"],
            "product_id": row["product_id"],
            "title": row["title"] or (product.title if product else "Campus Purchase"),
            "status": _normalize_order_status(row["status"] or "Processing"),
            "fulfillment_status": _normalize_order_status(row["status"] or "Processing"),
            "price": row["price"],
            "created_at": row["created_at"],
            "pickup_location": pickup_location,
            "payment_status": payment_status,
            "seller_name": seller_name,
            "seller": seller_name,
            "reviewed": bool(row["reviewed"]),
        })

    return result


@app.post("/api/student/review")
def submit_student_review(payload: ReviewCreate, db: Session = Depends(get_db)):
    _validate_student_id(db, payload.student_id, field_name="student_id")

    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if str(order.student_id) != str(payload.student_id):
        raise HTTPException(status_code=403, detail="You can only review your own order.")

    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    if not payload.comment or not payload.comment.strip():
        raise HTTPException(status_code=400, detail="Review comment is required.")

    try:
        existing_review = db.query(Review).filter(
            Review.order_id == payload.order_id,
            Review.student_id == payload.student_id,
        ).first()

        if existing_review:
            existing_review.rating = payload.rating
            existing_review.comment = payload.comment.strip()
            review_record = existing_review
        else:
            review_record = Review(
                order_id=payload.order_id,
                student_id=payload.student_id,
                rating=payload.rating,
                comment=payload.comment.strip(),
            )
            db.add(review_record)

        db.execute(text("UPDATE orders SET reviewed = TRUE, payment_status = 'Successful' WHERE id = :order_id"), {"order_id": payload.order_id})
        db.commit()
        db.refresh(review_record)

        return {
            "success": True,
            "message": "Review submitted successfully.",
            "review_id": review_record.id,
            "order_id": payload.order_id,
            "reviewed": True,
        }
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not submit review: {str(exc)}") from exc


@app.get("/api/student/payments")
def get_student_payments(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    transactions = (
        db.query(Transaction)
        .filter(Transaction.student_id == student_id)
        .order_by(Transaction.created_at.desc())
        .all()
    )

    recent_tx = "No transactions yet"
    recent_tx_record = transactions[0] if transactions else None
    if recent_tx_record:
        recent_tx = recent_tx_record.description or f"{recent_tx_record.type} — {recent_tx_record.tx_id}"

    ledger = []
    for tx in transactions[:20]:
        amount = float(tx.amount or 0)
        ledger.append({
            "id": tx.id,
            "type": tx.type,
            "label": tx.description or tx.type,
            "amount": amount,
            "status": tx.status,
            "date": tx.created_at.strftime("%Y-%m-%d") if tx.created_at else None,
            "hash": tx.tx_id,
        })

    return {
        "balance": float(student.wallet_balance or 0),
        "recentTx": recent_tx,
        "transactions": ledger,
    }


@app.get("/api/student/orders/tracker")
def get_student_order_tracker(student_id: str, db: Session = Depends(get_db)):
    orders = (
        db.query(Order)
        .filter(Order.student_id == student_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    order_payload = []
    for order in orders:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        pickup_location = _resolve_pickup_location(db, product)
        timeline = _build_order_timeline(order.status, pickup_location)
        order_payload.append({
            "id": order.id,
            "title": order.title or (product.title if product else "Campus Purchase"),
            "status": order.status,
            "price": order.price,
            "pickup_location": pickup_location,
            "timeline": timeline,
            "created_at": order.created_at,
        })

    return {"orders": order_payload}


# 8. ተማሪ ዊሽሊስት ዉስጥ እቃ ማስገባት (POST /api/student/wishlist)
@app.post("/api/student/wishlist", status_code=status.HTTP_201_CREATED)
def create_wishlist_item(wishlist_data: WishlistCreate, db: Session = Depends(get_db)):
    raw_student_id = wishlist_data.student_id
    normalized_student_id = str(raw_student_id).strip() if raw_student_id is not None else ""

    if not normalized_student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")

    admin_user = db.query(Admin).filter(
        or_(Admin.username == normalized_student_id, Admin.email == normalized_student_id)
    ).first()
    if admin_user:
        raise HTTPException(
            status_code=400,
            detail="Invalid student_id. Please provide a valid student ID, not an admin username."
        )

    student = db.query(Student).filter(Student.student_id == normalized_student_id).first()
    if not student:
        raise HTTPException(
            status_code=400,
            detail="Invalid student_id. The student does not exist in the students table."
        )

    product = db.query(Product).filter(Product.id == wishlist_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    existing_item = (
        db.query(WishlistItem)
        .filter(
            WishlistItem.student_id == normalized_student_id,
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

@app.get("/api/admin/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    total_students = db.query(Student).count()
    total_products = db.query(Product).count()
    product_status_rows = db.query(Product.status, func.count(Product.id)).group_by(Product.status).all()
    product_status_breakdown = {"Approved": 0, "Pending": 0, "Rejected": 0}
    for status_value, count in product_status_rows:
        normalized = (status_value or "").strip().title()
        if normalized in product_status_breakdown:
            product_status_breakdown[normalized] = int(count)

    successful_orders = db.query(Order).filter(Order.status.in_(["Completed", "Successful"])).count()
    revenue_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    revenue_total = float(revenue_total)

    def format_revenue(value: float) -> str:
        if value >= 1_000_000:
            return f"{value / 1_000_000:.1f}M ETB"
        if value >= 1_000:
            return f"{value / 1_000:.1f}K ETB"
        return f"{value:,.0f} ETB"

    department_rows = db.query(
        Student.department,
        func.count(Student.id).label("count")
    ).group_by(Student.department).order_by(func.count(Student.id).desc()).all()

    department_activity = []
    for index, (department_name, count) in enumerate(department_rows):
        color_palette = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-slate-500", "bg-cyan-500", "bg-pink-500"]
        department_activity.append({
            "name": department_name or "Unknown",
            "value": int(count),
            "color": color_palette[index % len(color_palette)]
        })

    college_rows = db.query(
        Student.college,
        func.count(Student.id).label("count")
    ).group_by(Student.college).order_by(func.count(Student.id).desc()).all()

    college_activity = []
    for index, (college_name, count) in enumerate(college_rows):
        color_palette = ["bg-indigo-500", "bg-sky-500", "bg-teal-500", "bg-rose-500", "bg-amber-500", "bg-purple-500"]
        college_activity.append({
            "name": college_name or "Unknown",
            "value": int(count),
            "color": color_palette[index % len(color_palette)]
        })

    category_rows = db.query(
        Product.category,
        func.count(Product.id).label("product_count")
    ).group_by(Product.category).order_by(func.count(Product.id).desc()).limit(5).all()

    categories = []
    for category_name, product_count in category_rows:
        categories.append({
            "name": category_name or "General",
            "views": f"{int(product_count * 180):,}",
            "likes": f"{int(product_count * 42):,}",
            "sales": f"{int(product_count * 16):,}"
        })

    while len(categories) < 5:
        fallback_categories = [
            {"name": "Electronics", "views": "18.4K", "likes": "4.2K", "sales": "1,280"},
            {"name": "Books", "views": "12.1K", "likes": "3.1K", "sales": "930"},
            {"name": "Lab Equipment", "views": "9.6K", "likes": "2.7K", "sales": "760"},
            {"name": "Accessories", "views": "8.3K", "likes": "2.2K", "sales": "640"},
            {"name": "Stationery", "views": "6.7K", "likes": "1.8K", "sales": "490"}
        ]
        for fallback in fallback_categories:
            if not any(item["name"] == fallback["name"] for item in categories):
                categories.append(fallback)
            if len(categories) >= 5:
                break

    recent_rows = db.query(
        Transaction.type,
        Transaction.description,
        Transaction.created_at,
        Transaction.student_id
    ).order_by(Transaction.created_at.desc()).limit(5).all()

    recent_activity = []
    for tx_type, description, created_at, student_id in recent_rows:
        recent_activity.append({
            "time": (created_at.strftime("%I:%M %p") if created_at else "--:--"),
            "action": description or f"{tx_type} transaction recorded",
            "user": f"Student • {student_id}"
        })

    if not recent_activity:
        recent_activity = [
            {"time": "08:42 AM", "action": "New electronics listing approved by admin", "user": "Student • MAU1602041"},
            {"time": "09:15 AM", "action": "Engineering books category gained 18% more click-through", "user": "AI Recommendation Engine"},
            {"time": "10:05 AM", "action": "Payment verified for a laptop order from IT department", "user": "Finance • TXN-11842"},
            {"time": "12:20 PM", "action": "Three new student accounts were verified successfully", "user": "Admin Review Queue"},
            {"time": "02:40 PM", "action": "Lab equipment recommendation campaign reached 1.2K impressions", "user": "Marketing Module"}
        ]

    activity_ratio = max(1, len(department_activity))
    department_activity = [
        {
            "name": item["name"],
            "value": int(round((item["value"] / sum(d["value"] for d in department_activity if d["value"]) or 1) * 100)),
            "color": item["color"]
        }
        for item in department_activity
    ]

    status_distribution = [
        {"label": "Completed", "value": 58, "color": "#10b981"},
        {"label": "Pending", "value": 22, "color": "#f59e0b"},
        {"label": "Processing", "value": 14, "color": "#3b82f6"},
        {"label": "Cancelled", "value": 6, "color": "#ef4444"}
    ]

    return {
        "users": total_students,
        "products": total_products,
        "orders": successful_orders,
        "revenue": format_revenue(revenue_total),
        "salesTrend": [32, 50, 44, 68, 62, 81, 96],
        "revenueTrend": [18, 26, 30, 49, 52, 64, 88],
        "registrations": [12, 18, 16, 26, 24, 31, 39],
        "orderStatus": status_distribution,
        "categories": categories,
        "departmentActivity": department_activity,
        "collegeActivity": college_activity,
        "productStatusBreakdown": product_status_breakdown,
        "recentActivity": recent_activity,
    }

# 8. የተማሪዎች ዝርዝር መጥሪያ (GET /api/admin/users)
@app.get("/api/admin/users")
def get_admin_users(
    search: Optional[str] = None,
    college: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Student)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name.ilike(term),
                Student.email.ilike(term),
                Student.student_id.ilike(term),
            )
        )

    if college and college.strip().lower() != "all":
        query = query.filter(Student.college.ilike(college.strip()))

    if department and department.strip().lower() != "all":
        query = query.filter(Student.department.ilike(department.strip()))

    students = query.order_by(Student.id.desc()).all()
    results = []

    for s in students:
        active_listing_count = db.query(Product).filter(
            or_(Product.seller == s.student_id, Product.seller == s.name),
            Product.status.ilike("Approved"),
        ).count()

        wallet_balance = float(s.wallet_balance) if s.wallet_balance is not None else 0.0

        results.append({
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "student_id": s.student_id,
            "phone": s.phone,
            "college": s.college,
            "department": s.department,
            "year": s.student_id[:4] if s.student_id and s.student_id[:4].isdigit() else "Year 1",
            "is_verified": bool(s.is_verified),
            "status": s.status or "Active",
            "restriction_reason": s.restriction_reason,
            "wallet_balance": wallet_balance,
            "active_listings": active_listing_count,
            "rating": "No ratings",
            "activity": [{"action": "Account synced", "time": "Recently"}],
            "role": "Student",
        })

    return results

# 8a. Get distinct colleges from UNIVERSITY_STRUCTURE
@app.get("/api/admin/colleges")
def get_colleges():
    """Returns all 6 colleges from the university structure."""
    return sorted(list(UNIVERSITY_STRUCTURE.keys()))


# 8b. Get departments (optionally filtered by college)
@app.get("/api/admin/departments")
def get_departments(college: Optional[str] = None):
    """
    Returns departments from the university structure.
    If college is provided, returns only that college's departments.
    Otherwise, returns all departments flattened.
    """
    if college and college in UNIVERSITY_STRUCTURE:
        return UNIVERSITY_STRUCTURE[college]
    
    # Return all departments from all colleges (flattened)
    all_departments = []
    for depts in UNIVERSITY_STRUCTURE.values():
        all_departments.extend(depts)
    return sorted(all_departments)

# 9. የተማሪን አካውንት ማገጃ/ማስተካከያ (PUT /api/admin/users/{id}/status)
@app.put("/api/admin/users/{id}/status")
def update_user_status(id: int, payload: UserStatusUpdate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    normalized_status = (payload.status or "").strip()
    valid_statuses = {"Active", "Suspended", "Deactivated"}
    if normalized_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Status must be one of: Active, Suspended, Deactivated")

    reason_text = (payload.reason or "").strip() if payload.reason else ""
    if normalized_status in {"Suspended", "Deactivated"} and not reason_text:
        reason_text = "Policy review"

    try:
        student.status = normalized_status
        student.restriction_reason = reason_text if normalized_status in {"Suspended", "Deactivated"} else None

        if normalized_status in {"Suspended", "Deactivated"}:
            admin = db.query(Admin).order_by(Admin.id.asc()).first()
            message = (
                f"Your account has been restricted. Reason: {reason_text}. Please contact support for review."
            )

            db.add(Notification(
                student_id=student.student_id,
                message=message,
                is_read=False,
            ))

            db.add(AuditLog(
                admin_id=admin.id if admin else None,
                action=f"User {normalized_status}",
                entity_type="User",
                entity_id=student.id,
                description=(
                    f"Admin updated user {student.name} ({student.student_id}) to {normalized_status}."
                    f" Reason: {reason_text}."
                ),
                status="SUCCESS",
                ip_address="127.0.0.1",
            ))

        db.commit()
        db.refresh(student)

        return {
            "message": "User status updated successfully",
            "id": student.id,
            "student_id": student.student_id,
            "status": student.status,
            "reason": student.restriction_reason,
        }
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update user status.")

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

# 13. የተማሪ ማረጋገጫ አባሪዎች መግለጫ (GET /api/admin/verifications)
@app.get("/api/admin/verifications")
def get_admin_verifications(
    search: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Student).filter(Student.is_verified == False)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name.ilike(term),
                Student.student_id.ilike(term),
                Student.email.ilike(term),
            )
        )

    if department and department.strip().lower() != "all":
        query = query.filter(Student.department.ilike(department.strip()))

    students = query.order_by(Student.id.desc()).all()
    results = []
    for student in students:
        status = "Rejected" if student.verification_reason else "Pending"
        results.append({
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "email": student.email,
            "department": student.department or "General Studies",
            "status": status,
            "uploaded_id_card": student.id_card_url or "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80",
            "reason": student.verification_reason,
            "is_verified": student.is_verified,
        })

    return results


@app.put("/api/admin/verifications/{id}")
def update_student_verification(
    id: int,
    payload: VerificationDecisionRequest,
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    normalized_status = (payload.status or "").strip().lower()
    if normalized_status not in {"approved", "verified", "rejected", "rejected_flagged", "flagged"}:
        raise HTTPException(status_code=400, detail="Status must be one of: Approved, Verified, Rejected")

    approved = normalized_status in {"approved", "verified"}
    rejection_reason = (payload.reason or "").strip() if not approved else None

    if not approved and not rejection_reason:
        raise HTTPException(status_code=400, detail="A rejection reason is required when rejecting a student verification request.")

    admin = db.query(Admin).order_by(Admin.id.asc()).first()

    try:
        with db.begin():
            if approved:
                student.is_verified = True
                student.verification_reason = None
                notification_message = (
                    f"Your student identity has been successfully verified. "
                    "You can now access full marketplace features and complete transactions without restrictions."
                )
                log_action = "Student Verification Approved"
                description = f"Admin approved student verification for {student.name} ({student.student_id})."
            else:
                student.is_verified = False
                student.verification_reason = rejection_reason
                notification_message = (
                    f"Your student identity verification was rejected. "
                    f"Reason: {rejection_reason}. Please resubmit a clear and readable student ID."
                )
                log_action = "Student Verification Rejected"
                description = (
                    f"Admin rejected student verification for {student.name} ({student.student_id}) "
                    f"with reason: {rejection_reason}."
                )

            db.add(Notification(
                student_id=student.student_id,
                message=notification_message,
                is_read=False,
            ))

            db.add(AuditLog(
                admin_id=admin.id if admin else None,
                action=log_action,
                entity_type="Student",
                entity_id=student.id,
                description=description,
                status="SUCCESS",
                ip_address="127.0.0.1",
            ))

            try:
                send_verification_status_email(student.email, "Approved" if approved else "Rejected", rejection_reason)
            except Exception:
                pass

            db.flush()

        return {
            "message": "Student verification updated successfully",
            "student_id": student.student_id,
            "status": "Approved" if approved else "Rejected",
            "reason": rejection_reason,
            "is_verified": student.is_verified,
        }
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process student verification request.")


# 13. የዕቃዎች ዝርዝር መጥሪያ (GET /api/admin/products)
@app.get("/api/admin/products")
def get_admin_products(
    status: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if status and status.strip().lower() != "all":
        query = query.filter(Product.status.ilike(status.strip()))

    if category and category.strip().lower() != "all":
        query = query.filter(Product.category.ilike(category.strip()))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.title.ilike(term),
                Product.description.ilike(term),
                Product.category.ilike(term),
                Product.seller.ilike(term),
            )
        )

    products = query.order_by(Product.created_at.desc()).all()
    results = []
    for p in products:
        seller_id = p.seller or "Unknown"
        student_record = db.query(Student).filter(
            (Student.student_id == seller_id) | (Student.name == seller_id)
        ).first()

        normalized_price = p.price or "0 ETB"
        price_value = str(normalized_price).replace(",", "").replace(" ETB", "").replace("etb", "").strip()
        try:
            condition = "New" if float(price_value) >= 1000 else "Gently Used"
        except (TypeError, ValueError):
            condition = "New"

        results.append({
            "id": p.id,
            "title": p.title,
            "seller": p.seller or "Student",
            "seller_id": seller_id,
            "category": p.category,
            "status": p.status or "Pending",
            "price": p.price,
            "image": p.image,
            "description": p.description or "No description provided yet.",
            "condition": condition,
            "seller_verified": bool(student_record),
            "moderation_reason": p.moderation_reason,
        })

    return results

# 14. የተለጠፈ እቃን ማስተካከያ/ማፅደቂያ (PATCH /api/admin/products/{id})
@app.patch("/api/admin/products/{id}")
def update_product_status(id: int, data: ProductStatusUpdate, db: Session = Depends(get_db)):
    return update_product_status_impl(id=id, data=data, db=db)

@app.put("/api/admin/products/{id}")
def update_product_status_put(id: int, data: ProductStatusUpdate, db: Session = Depends(get_db)):
    return update_product_status_impl(id=id, data=data, db=db)


def update_product_status_impl(id: int, data: ProductStatusUpdate, db: Session):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    normalized_status = (data.status or "").strip()
    if not normalized_status:
        raise HTTPException(status_code=400, detail="Status is required.")

    action_label = normalized_status.lower()
    product.status = normalized_status

    reason_text = None
    if data.reason and data.reason.strip():
        reason_text = data.reason.strip()
        product.moderation_reason = reason_text

    if action_label in {"flagged", "rejected", "rejected_flagged", "flag"}:
        if reason_text is None:
            raise HTTPException(status_code=400, detail="A rejection reason is required when flagging or rejecting a product.")

    seller_id = product.seller or None
    seller_student = None
    if seller_id:
        seller_student = db.query(Student).filter(
            (Student.student_id == seller_id) | (Student.name == seller_id)
        ).first()

    try:
        if action_label in {"flagged", "rejected", "flag", "rejected_flagged"}:
            notification_message = (
                f"Your listing '{product.title}' was flagged by the admin moderation team. "
                f"Reason: {reason_text}. Please review and update the listing before it is re-approved."
            )
            if seller_student:
                db.add(Notification(
                    student_id=seller_student.student_id,
                    message=notification_message,
                    is_read=False,
                ))
            elif seller_id:
                db.add(Notification(
                    student_id=seller_id,
                    message=notification_message,
                    is_read=False,
                ))

        admin = db.query(Admin).order_by(Admin.id.asc()).first()
        log_action = "Product Approved" if normalized_status.lower() == "approved" else "Product Flagged" if normalized_status.lower() in {"flagged", "flag"} else "Product Rejected" if normalized_status.lower() in {"rejected", "rejected_flagged"} else f"Product {normalized_status}"
        log_desc = (
            f"Admin updated product '{product.title}' to status '{normalized_status}'."
            if reason_text is None
            else f"Admin updated product '{product.title}' to status '{normalized_status}' with reason: {reason_text}."
        )

        db.add(AuditLog(
            admin_id=admin.id if admin else None,
            action=log_action,
            entity_type="Product",
            entity_id=product.id,
            description=log_desc,
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))

        db.commit()
        db.refresh(product)

        return {
            "message": "Product status updated successfully",
            "product": {
                "id": product.id,
                "title": product.title,
                "status": product.status,
                "reason": product.moderation_reason,
            },
            "notification_created": bool(seller_student or seller_id),
        }
    except Exception:
        db.rollback()
        raise

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
def get_admin_payments_endpoint(
    search: Optional[str] = None,
    payment_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    try:
        query = db.query(Transaction)

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Transaction.tx_id.ilike(term),
                    Transaction.student_id.ilike(term),
                    Transaction.description.ilike(term),
                    Transaction.type.ilike(term),
                )
            )

        if payment_type and payment_type.strip().lower() != "all":
            normalized = _normalize_payment_type(payment_type)
            query = query.filter(
                (Transaction.type.ilike(f"%{normalized}%"))
                | (Transaction.description.ilike(f"%{normalized}%"))
            )

        if status and str(status).strip().lower() != "all":
            normalized_status = str(status).strip().title()
            query = query.filter(Transaction.status.ilike(f"%{normalized_status}%"))

        transactions = query.order_by(Transaction.created_at.desc()).limit(limit).all()

        results = []
        for tx in transactions:
            payment_type_value = _normalize_payment_type(tx.type or tx.description or "Product Purchase")
            payment_status = _normalize_payment_status(tx.status or "Pending")
            payment_method = (
                "Chapa" if payment_type_value == "Product Purchase"
                else "Wallet" if payment_type_value == "Wallet Deposit"
                else "SantimPay" if payment_type_value == "Seller Payout"
                else "Wallet"
            )

            results.append({
                "id": tx.id,
                "transaction_id": tx.tx_id,
                "buyer_id": tx.student_id,
                "seller_id": tx.student_id,
                "order_id": tx.tx_id,
                "amount": float(tx.amount or 0),
                "payment_type": payment_type_value,
                "payment_method": payment_method,
                "status": payment_status,
                "date": tx.created_at.isoformat() if tx.created_at else None,
                "student_id": tx.student_id,
                "type": tx.type,
                "description": tx.description,
            })

        return results
    except (OperationalError, SQLAlchemyError) as exc:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to load payment transactions",
                "detail": str(exc),
            },
        )
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={
                "error": "Unexpected error while loading payment transactions",
                "detail": str(exc),
            },
        )


@app.put("/api/admin/payments/{payment_id}/status")
def update_admin_payment_status(payment_id: int, payload: dict, db: Session = Depends(get_db)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payment status payload must be a JSON object.")

    transaction = db.query(Transaction).filter(Transaction.id == payment_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found.")

    new_status = _normalize_payment_status(payload.get("status") or payload.get("payment_status") or transaction.status)
    transaction.status = new_status
    db.commit()
    db.refresh(transaction)

    return {
        "message": "Payment status updated successfully",
        "id": transaction.id,
        "transaction_id": transaction.tx_id,
        "status": new_status,
    }


@app.get("/api/admin/orders")
def get_admin_orders(db: Session = Depends(get_db)):
    try:
        rows = db.query(Order).order_by(Order.created_at.desc()).all()
        results = []
        for order in rows:
            amount_value = 0.0
            try:
                if isinstance(order.price, str):
                    cleaned = order.price.replace("ETB", "").replace("$", "").replace(",", "").strip()
                    amount_value = float(cleaned) if cleaned else 0.0
                elif order.price is not None:
                    amount_value = float(order.price)
            except (TypeError, ValueError):
                amount_value = 0.0

            product = db.query(Product).filter(Product.id == order.product_id).first()
            product_title = product.title if product else (order.title or "Unnamed Product")
            seller_id = product.seller if product and product.seller else "Unknown"
            buyer_id = order.student_id
            order_status = _normalize_order_status(order.status)
            payment_status = "Pending"
            payment_rows = db.query(Transaction).filter(Transaction.student_id == buyer_id).order_by(Transaction.created_at.desc()).all()
            if payment_rows:
                payment_status = _normalize_payment_status(payment_rows[0].status)

            record = {
                "id": order.id,
                "buyer_id": buyer_id,
                "seller_id": seller_id,
                "product_title": product_title,
                "total_amount": amount_value,
                "order_status": order_status,
                "payment_status": payment_status,
                "pay_status": payment_status,
                "pickup_location": "Main Library",
                "date": order.created_at.isoformat() if order.created_at else None,
                "price": f"{amount_value:,.0f} ETB",
                "item": product_title,
                "buyer": buyer_id,
                "seller": seller_id,
                "amount": amount_value,
            }
            results.append(record)
        return results
    except (OperationalError, SQLAlchemyError) as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Failed to load order records", "detail": str(exc)})
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Unexpected error while loading order records", "detail": str(exc)})


@app.put("/api/admin/orders/{order_id}")
def update_admin_order(order_id: int, payload: dict, db: Session = Depends(get_db)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Order update payload must be a JSON object.")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    updated_order_status = _normalize_order_status(payload.get("order_status") or order.status)
    updated_payment_status = _normalize_payment_status(payload.get("payment_status") or payload.get("pay_status") or "Pending")
    pickup_location = str(payload.get("pickup_location") or "Main Library")

    order.status = updated_order_status
    if hasattr(order, "payment_status"):
        order.payment_status = updated_payment_status
    if hasattr(order, "pickup_location"):
        order.pickup_location = pickup_location

    db.commit()
    db.refresh(order)

    return {
        "message": "Order status updated successfully",
        "id": order.id,
        "order_status": updated_order_status,
        "payment_status": updated_payment_status,
        "pickup_location": pickup_location,
    }


@app.post("/api/admin/payments/webhook")
def simulate_chapa_webhook(
    payload: dict,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object.")

    secret = os.getenv("CHAPA_SECRET_KEY", "campace_dev_secret")
    callback_signature = authorization or payload.get("signature") or payload.get("x_chapa_signature")
    if callback_signature:
        expected = _compute_chapa_signature(secret, payload)
        if callback_signature.lower().startswith("bearer "):
            callback_signature = callback_signature.split(" ", 1)[1]
        if callback_signature != expected and callback_signature.lower() != expected.lower():
            raise HTTPException(status_code=401, detail="Invalid transaction signature.")

    status_value = str(payload.get("status") or payload.get("state") or "pending").strip().lower()
    if status_value not in {"success", "successful", "paid", "completed"}:
        raise HTTPException(status_code=400, detail="Payment callback status is not successful.")

    tx_ref = str(
        payload.get("tx_ref")
        or payload.get("transaction_id")
        or payload.get("tx_id")
        or payload.get("reference")
        or "TX-UNKNOWN"
    )
    amount_value = payload.get("amount") or payload.get("total_amount") or 0
    try:
        amount = Decimal(str(amount_value)).quantize(Decimal("0.01"))
    except Exception:
        amount = Decimal("0")

    student_identifier = (
        payload.get("student_id")
        or payload.get("buyer_id")
        or payload.get("studentId")
        or payload.get("customer")
    )
    if isinstance(student_identifier, dict):
        student_identifier = (
            student_identifier.get("student_id")
            or student_identifier.get("buyer_id")
            or student_identifier.get("studentId")
        )

    student = None
    if student_identifier:
        student = db.query(Student).filter(Student.student_id == str(student_identifier)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found for payment callback.")

    student.wallet_balance = Decimal(str(student.wallet_balance or 0)) + amount

    tx_record = db.query(Transaction).filter(Transaction.tx_id == tx_ref).first()
    if tx_record is None:
        tx_record = Transaction(
            student_id=student.student_id,
            tx_id=tx_ref,
            type="Wallet Deposit",
            amount=float(amount),
            description="Chapa webhook settlement captured via payment callback.",
            status="Successful",
        )
        db.add(tx_record)
    else:
        tx_record.type = "Wallet Deposit"
        tx_record.amount = float(amount)
        tx_record.status = "Successful"
        tx_record.description = tx_record.description or "Chapa webhook settlement captured via payment callback."

    admin = db.query(Admin).order_by(Admin.id.asc()).first()
    if admin:
        db.add(AuditLog(
            admin_id=admin.id,
            action="Payment Webhook Success",
            entity_type="Payment",
            entity_id=tx_record.id,
            description=f"Chapa webhook processed successfully for student {student.student_id}, tx_ref {tx_ref}, amount {amount} ETB.",
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))

    db.commit()
    db.refresh(tx_record)

    return {
        "message": "Payment webhook processed successfully.",
        "status": "Successful",
        "transaction_id": tx_record.tx_id,
        "student_id": student.student_id,
        "wallet_balance": float(student.wallet_balance),
        "amount": float(amount),
    }

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

# 19. የስርዓት ቅንብርን ማብሪያ/ማጥፊያ (PATCH /api/admin/settings/{id})
@app.patch("/api/admin/settings/{id}")
def update_setting(id: int, data: SettingUpdate):
    return {"message": "Setting updated successfully"}


@app.get("/api/admin/settings/{id}")
def get_setting(id: int):
    return {"id": id, "value": True, "message": "Setting retrieved successfully"}
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

class CartItemQuantityUpdate(BaseModel):
    quantity: int

# University Structure: All 6 Colleges and their Departments
UNIVERSITY_STRUCTURE = {
    "College of Computing and Informatics (CCI)": [
        "Department of Computer Science",
        "Department of Information Technology (IT)",
        "Department of Software Engineering"
    ],
    "College of Natural and Computational Sciences (CNCS)": [
        "Department of Biology",
        "Department of Chemistry",
        "Department of Geology",
        "Department of Mathematics",
        "Department of Physics",
        "Department of Statistics",
        "Department of Sport Science"
    ],
    "College of Agriculture and Natural Resource": [
        "Department of Agro-Economics",
        "Department of Agribusiness and Value Chain Management",
        "Department of Animal Science",
        "Department of Forestry",
        "Department of Horticulture",
        "Department of Natural Resource Management",
        "Department of Plant Science",
        "Department of Rural Development and Agricultural Extension"
    ],
    "College of Business and Economics": [
        "Department of Accounting and Finance",
        "Department of Economics",
        "Department of Management",
        "Department of Marketing Management"
    ],
    "College of Social Sciences and Humanities": [
        "Department of Amharic Language and Literature",
        "Department of English Language and Literature",
        "Department of Geography and Environmental Studies",
        "Department of History and Heritage Management",
        "Department of Political Science and International Relations"
    ],
    "School of Law": [
        "Department of Law (LLB)"
    ]
}

# Category and Subcategory Creation Schemas
class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None

class SubCategoryCreate(BaseModel):
    name: str
    category_id: int
    icon: Optional[str] = None

# 21. Create Main Category (POST /api/admin/categories)
@app.post("/api/admin/categories", status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    """Insert a new main category into the database"""
    # Check if category name already exists
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    db_category = Category(
        name=data.name,
        icon=data.icon,
        ads_count="0 ads"
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return {
        "id": db_category.id,
        "name": db_category.name,
        "icon": db_category.icon,
        "ads_count": db_category.ads_count,
        "status": "Active"
    }

# 22. Create Subcategory (POST /api/admin/subcategories)
@app.post("/api/admin/subcategories", status_code=status.HTTP_201_CREATED)
def create_subcategory(data: SubCategoryCreate, db: Session = Depends(get_db)):
    """Insert a new subcategory under a parent category"""
    # Verify parent category exists
    parent_category = db.query(Category).filter(Category.id == data.category_id).first()
    if not parent_category:
        raise HTTPException(status_code=404, detail="Parent category not found")
    
    # Check if subcategory name already exists under this parent
    existing = db.query(SubCategory).filter(
        SubCategory.name == data.name,
        SubCategory.category_id == data.category_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subcategory already exists under this category")
    
    db_subcategory = SubCategory(
        name=data.name,
        icon=data.icon,
        category_id=data.category_id,
        ads_count="0 ads"
    )
    db.add(db_subcategory)
    db.commit()
    db.refresh(db_subcategory)
    
    return {
        "id": db_subcategory.id,
        "name": db_subcategory.name,
        "icon": db_subcategory.icon,
        "category_id": db_subcategory.category_id,
        "ads_count": db_subcategory.ads_count
    }

# 23. Fetch all categories with subcategories (GET /api/admin/categories/all)
@app.get("/api/admin/categories/all")
def get_all_categories_with_subs(db: Session = Depends(get_db)):
    """Retrieve all main categories and their nested subcategories"""
    categories = db.query(Category).all()
    result = []
    
    for cat in categories:
        category_ads = db.query(Product).filter(
            Product.category == cat.name,
            Product.status == "Approved"
        ).count()
        
        subcategories = []
        for sub in cat.subcategories:
            subcategory_ads = db.query(Product).filter(
                Product.category == cat.name,
                Product.subcategory == sub.name,
                Product.status == "Approved"
            ).count()
            subcategories.append({
                "id": sub.id,
                "name": sub.name,
                "icon": sub.icon,
                "category_id": sub.category_id,
                "ads": f"{subcategory_ads} ads"
            })
        
        result.append({
            "id": cat.id,
            "name": cat.name,
            "icon": cat.icon,
            "ads": f"{category_ads} ads",
            "status": "Active",
            "subcategories": subcategories
        })
    
    return result

# 24. Delete a Category by ID (DELETE /api/admin/categories/{id})
@app.delete("/api/admin/categories/{id}")
def delete_category(id: int, db: Session = Depends(get_db)):
    """Delete a main category by its ID"""
    try:
        category = db.query(Category).filter(Category.id == id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        db.delete(category)
        db.commit()
        
        return {"message": "Category deleted successfully", "id": id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")

# 25. Delete a Subcategory by ID (DELETE /api/admin/subcategories/{id})
@app.delete("/api/admin/subcategories/{id}")
def delete_subcategory(id: int, db: Session = Depends(get_db)):
    """Delete a subcategory by its ID"""
    try:
        subcategory = db.query(SubCategory).filter(SubCategory.id == id).first()
        if not subcategory:
            raise HTTPException(status_code=404, detail="Subcategory not found")
        
        db.delete(subcategory)
        db.commit()
        
        return {"message": "Subcategory deleted successfully", "id": id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete subcategory: {str(e)}")
