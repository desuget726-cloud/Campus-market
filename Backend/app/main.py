from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, status, Form, UploadFile, File, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import event, func, inspect, or_, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
import bcrypt
from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass
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
import math
import mimetypes
import base64
from decimal import Decimal
from collections import Counter
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
import  bcrypt
from deep_translator import GoogleTranslator
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ßêüßêëßèòßê¥ ßï¿ßï│ßë│ßëñßï¥ ßê░ßèòßîáßê¿ßïªßë╜ (Models) ßèÑßèô ßê¢ßîêßèôßè¢ßïÄßë╜ßèò ßè¿ßêîßêÄßë╣ ßìïßï¡ßêÄßë╜ ßèÑßèòßîáßê½ßêêßèò
from .models import (
    Student, Category, SubCategory, Product, Admin, AuditLog, Report,
    Notification, Message, WishlistItem, CartItem, Order, Transaction,
    PasswordReset, SystemSetting, Review, LoginAttempt
)
from .database import get_db, init_db, SessionLocal, Base, engine


app = FastAPI(title="Campace Backend")

# React ßîìßèòßèÖßèÉßë╡ ßêÿßììßëÇßîâ (CORS)
origins = [
    "http://localhost:5173",      # Γ£ô React frontend (dev)
    "http://127.0.0.1:5173",      # Γ£ô Alternative localhost
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # Γ£ô Uses origins list
    allow_credentials=True,       # Γ£ô Allow cookies/auth
    allow_methods=["*"],          # Γ£ô All HTTP methods
    allow_headers=["*"],          # Γ£ô All headers
)

# Create static directory for uploads if it doesn't exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(STATIC_DIR, exist_ok=True)
AVATAR_DIR = os.path.join(STATIC_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)
ATTACHMENT_DIR = os.path.join(STATIC_DIR, "attachments")
os.makedirs(ATTACHMENT_DIR, exist_ok=True)
ID_CARD_DIR = os.path.join(STATIC_DIR, "id_cards")
os.makedirs(ID_CARD_DIR, exist_ok=True)

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

    async def broadcast(self, message: dict, exclude_student_id: Optional[str] = None):
        """Broadcast a payload to all connected students except the sender."""
        async with self._lock:
            recipients = [
                (student_id, websocket)
                for student_id, websocket in self.active_connections.items()
                if student_id != exclude_student_id
            ]

        for student_id, websocket in recipients:
            try:
                await websocket.send_json(message)
            except Exception as exc:
                self.logger.error(f"[CHAT BROADCAST ERROR] Failed to notify {student_id}: {str(exc)}")

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
        term: 1.0 + (float(math.log((1 + doc_count) / (1 + doc_frequency.get(term, 0)))) + 1.0)
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
    norm_a = math.sqrt(sum(value * value for value in vec_a.values()))
    norm_b = math.sqrt(sum(value * value for value in vec_b.values()))
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


# Read Gmail SMTP credentials from Backend/.env or the process environment.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "desu5392@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "yzekmnucvxcbnzni")

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
        if not _notifications_enabled(None, "emailNotifs"):
            email_logger.info("OTP email skipped because email notifications are disabled.")
            return True
        if not SENDER_EMAIL or not SENDER_PASSWORD:
            email_logger.error("OTP email is not configured. Set SENDER_EMAIL and SENDER_PASSWORD in Backend/.env.")
            return False
        if any(char.isspace() for char in SENDER_PASSWORD):
            email_logger.warning("SENDER_PASSWORD contains whitespace; verify the Google App Password is configured without spaces.")

        body = str(otp)

        msg = MIMEMultipart()
        msg["Subject"] = "Campace Verification Code"
        msg["From"] = SENDER_EMAIL
        msg["To"] = receiver_email
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())

        return True
    except smtplib.SMTPException as e:
        email_logger.exception(f"SMTP error while sending raw OTP email to {receiver_email}: {e}")
        return False
    except Exception as e:
        email_logger.exception(f"Failed to send raw OTP email to {receiver_email}: {e}")
        return False


def send_verification_status_email(receiver_email: str, status: str, reason: Optional[str] = None) -> bool:
    """Send a plain-text email summarizing the verification decision."""
    try:
        if not _notifications_enabled(None, "emailNotifs"):
            email_logger.info("Verification email skipped because email notifications are disabled.")
            return True
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


# ==========================================
# --- Pydantic Schemas ---
# ==========================================

class StudentRegister(BaseModel):
    name: str
    student_id: str
    email: str
    phone: Optional[str] = None
    password: str
    college: str
    department: str


class LoginRequest(BaseModel):
    id_or_email: str
    password: str


class AdminLoginOtpRequest(BaseModel):
    email: str
    otp_code: str


class ForgotPasswordRequest(BaseModel):
    email: str


class VerifyResetCodeRequest(BaseModel):
    email: str
    otp_code: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str


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


class BroadcastNotificationRequest(BaseModel):
    title: Optional[str] = None
    message: str
    target: Optional[str] = "All Students"
    sendType: Optional[str] = "instant"
    scheduleDate: Optional[str] = None
    scheduleTime: Optional[str] = None


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


class ReportCreate(BaseModel):
    student_id: Optional[str] = None
    student_name: str
    email: str
    category: str
    issue: str


class WishlistCreate(BaseModel):
    student_id: str
    product_id: int


class CartItemCreate(BaseModel):
    student_id: str
    product_id: int


class CartItemQuantityUpdate(BaseModel):
    quantity: int


class ReportUpdate(BaseModel):
    status: str
    decision: Optional[str] = None
    priority: Optional[str] = None
    resolved_at: Optional[str] = None


class SettingUpdate(BaseModel):
    value: bool


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None


class SubCategoryCreate(BaseModel):
    name: str
    category_id: int
    icon: Optional[str] = None


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


class StudentProductUpdate(BaseModel):
    student_id: str
    title: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class DepositRequest(BaseModel):
    student_id: str
    amount: float
    email: Optional[str] = None


class CheckoutRequest(BaseModel):
    student_id: str


class AIChatRequest(BaseModel):
    message: str


class AITranslateRequest(BaseModel):
    text: str
    target_language: str


class AIAdvisorRequest(BaseModel):
    message: str
    student_id: Optional[str] = None
    department: Optional[str] = None
    context: Optional[str] = "general"


class ReviewCreate(BaseModel):
    order_id: int
    student_id: str
    rating: int
    comment: str


class ChatInitiateRequest(BaseModel):
    buyer_id: str
    product_id: int


DEFAULT_SETTINGS_BLOCKS = {
    "general": {
        "marketplaceName": "Campace Market",
        "description": "A secure campus marketplace for buying and selling university essentials.",
        "supportEmail": "support@campace.edu.et",
        "currency": "ETB",
        "timezone": "Africa/Addis_Ababa",
    },
    "marketplace": {
        "maxImageSize": "5MB",
        "maxImagesPerProduct": 5,
        "requireApproval": True,
        "allowEditing": True,
        "autoHideSold": True,
    },
    "payment": {
        "paymentProvider": "Chapa",
        "currency": "ETB",
        "enableOnlinePayment": True,
        "paymentVerification": "Automatic",
        "refundsEnabled": True,
        "refundPolicy": "Admin approval required",
        "maximumRefund": "100%",
        "security": {
            "automaticVerification": True,
            "duplicateTransactionProtection": True,
            "adminApprovalForRefunds": True,
            "auditLogging": True,
        },
    },
    "ai": {
        "recommendationEngine": "Content-Based Filtering (TF-IDF)",
        "numRecommendations": 5,
        "minSimilarityScore": 0.20,
        "enableAI": True,
    },
    "notifications": {
        "emailNotifs": True,
        "orderNotifs": True,
        "messageNotifs": True,
        "approvalNotifs": True,
        "paymentNotifs": True,
        "announcementNotifs": True,
    },
    "security": {
        "requireStudentVerification": True,
        "admin2FA": True,
        "maxLoginAttempts": 5,
        "sessionTimeout": 30,
        "minPasswordLength": 8,
        "auditLogging": True,
    },
    "studentVerification": {
        "allowedEmailDomain": "university.edu.et",
        "requireUniversityEmail": True,
        "autoApproveStudents": False,
    },
    "moderation": {
        "autoHideReported": True,
        "requireAdminApproval": True,
        "maxReportsBeforeReview": 3,
        "allowStudentReports": True,
    },
    "chat": {"enabled": True, "allowAttachments": True, "maxMessageLength": 1000},
    "maintenance": {
        "maintenanceMode": False,
        "maintenanceMessage": "The marketplace is temporarily unavailable for maintenance.",
    },
}


def _parse_setting_value(value):
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


def _setting_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off", ""}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _get_setting_value(db: Session, block: str, key: str, default=None):
    block_record = db.query(SystemSetting).filter(SystemSetting.key == block).first()
    if block_record:
        block_value = _parse_setting_value(block_record.value)
        if isinstance(block_value, dict) and key in block_value:
            return block_value[key]
    return default


@dataclass(frozen=True)
class SecuritySettings:
    require_student_verification: bool
    admin_2fa: bool
    max_login_attempts: int
    session_timeout: int
    min_password_length: int
    audit_logging: bool


def get_security_settings(db: Session) -> SecuritySettings:
    """Read and normalize the six security controls from SystemSetting."""
    defaults = DEFAULT_SETTINGS_BLOCKS["security"]
    values = {
        key: _get_setting_value(db, "security", key, default)
        for key, default in defaults.items()
    }

    def positive_int(key: str) -> int:
        try:
            return max(1, int(values[key]))
        except (TypeError, ValueError):
            return defaults[key]

    return SecuritySettings(
        require_student_verification=_setting_bool(values["requireStudentVerification"], defaults["requireStudentVerification"]),
        admin_2fa=_setting_bool(values["admin2FA"], defaults["admin2FA"]),
        max_login_attempts=positive_int("maxLoginAttempts"),
        session_timeout=positive_int("sessionTimeout"),
        min_password_length=positive_int("minPasswordLength"),
        audit_logging=_setting_bool(values["auditLogging"], defaults["auditLogging"]),
    )


def _audit_logging_enabled(db: Session) -> bool:
    return get_security_settings(db).audit_logging


def _add_audit_log(db: Session, **values) -> None:
    if _audit_logging_enabled(db):
        db.add(AuditLog(**values))


def _session_timeout_minutes(db: Session) -> int:
    return get_security_settings(db).session_timeout


def _session_password_min_length(db: Session) -> int:
    return get_security_settings(db).min_password_length


def _login_identifier(value: str) -> str:
    return str(value or "").strip().lower()


def _check_login_lock(db: Session, identifier: str, settings: SecuritySettings) -> None:
    attempt = db.query(LoginAttempt).filter(LoginAttempt.identifier == identifier).first()
    if attempt and attempt.locked_until and attempt.locked_until > datetime.utcnow():
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Try again later or wait for 15 sec.")


def _record_failed_login(db: Session, identifier: str, settings: SecuritySettings) -> None:
    attempt = db.query(LoginAttempt).filter(LoginAttempt.identifier == identifier).first()
    if not attempt:
        attempt = LoginAttempt(identifier=identifier, failed_attempts=0)
        db.add(attempt)
    attempt.failed_attempts += 1
    if attempt.failed_attempts >= settings.max_login_attempts:
        attempt.locked_until = datetime.utcnow() + timedelta(minutes=settings.session_timeout)
    db.commit()


def _reset_login_attempts(db: Session, identifier: str) -> None:
    attempt = db.query(LoginAttempt).filter(LoginAttempt.identifier == identifier).first()
    if attempt:
        db.delete(attempt)
        db.commit()


def _create_session_token(subject: str, role: str, timeout_minutes: int, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "exp": int((datetime.utcnow() + timedelta(minutes=timeout_minutes)).timestamp()),
    }

    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()

    unsigned_token = f"{encode(header)}.{encode(payload)}"
    signature = hmac.new(secret.encode(), unsigned_token.encode(), hashlib.sha256).digest()
    return f"{unsigned_token}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def _notifications_enabled(db: Optional[Session], key: str) -> bool:
    default = DEFAULT_SETTINGS_BLOCKS["notifications"].get(key, True)
    owns_session = db is None
    settings_db = db or SessionLocal()
    try:
        return _setting_bool(_get_setting_value(settings_db, "notifications", key, default), default)
    except SQLAlchemyError:
        return default
    finally:
        if owns_session:
            settings_db.close()


def _parse_size_bytes(value, default=5 * 1024 * 1024):
    if isinstance(value, (int, float)) and value >= 0:
        return int(value)

    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?\s*", str(value or ""), re.IGNORECASE)
    if not match:
        return default

    units = {"B": 1, "KB": 1024, "MB": 1024 ** 2, "GB": 1024 ** 3}
    return int(float(match.group(1)) * units.get((match.group(2) or "B").upper(), 1))


def _settings_change_details(previous, current, prefix=""):
    changes = []
    keys = sorted(set(previous or {}) | set(current or {}))
    for key in keys:
        label = f"{prefix} {key}".strip()
        old_value = (previous or {}).get(key)
        new_value = (current or {}).get(key)
        if isinstance(old_value, dict) and isinstance(new_value, dict):
            changes.extend(_settings_change_details(old_value, new_value, label))
        elif old_value != new_value:
            changes.append(f"{label} changed from {old_value!r} to {new_value!r}")
    return changes


def _seed_default_system_settings(db: Session) -> None:
    existing = db.query(SystemSetting).count()
    if existing > 0:
        return

    for key, value in DEFAULT_SETTINGS_BLOCKS.items():
        db.add(SystemSetting(key=key, value=json.dumps(value, ensure_ascii=False)))

    db.commit()


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

        for column_name, definition in {
            "attachment_url": "VARCHAR(500) NULL",
            "attachment_type": "VARCHAR(20) NULL",
            "reply_to_id": "INT NULL",
        }.items():
            column = db.execute(text(f"SHOW COLUMNS FROM messages LIKE '{column_name}'"))
            if column.fetchone() is None:
                db.execute(text(f"ALTER TABLE messages ADD COLUMN {column_name} {definition}"))

        notification_target = db.execute(text("SHOW COLUMNS FROM notifications LIKE 'target'"))
        if notification_target.fetchone() is None:
            db.execute(text("ALTER TABLE notifications ADD COLUMN target VARCHAR(150) NULL"))

        audit_severity = db.execute(text("SHOW COLUMNS FROM audit_logs LIKE 'severity'"))
        if audit_severity.fetchone() is None:
            db.execute(text("ALTER TABLE audit_logs ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'informational'"))

        report_email = db.execute(text("SHOW COLUMNS FROM reports LIKE 'email'"))
        if report_email.fetchone() is None:
            db.execute(text("ALTER TABLE reports ADD COLUMN email VARCHAR(100) NULL"))
            legacy_report_email = db.execute(text("SHOW COLUMNS FROM reports LIKE 'contact_email'"))
            if legacy_report_email.fetchone() is not None:
                db.execute(text("UPDATE reports SET email = contact_email WHERE email IS NULL"))

        report_category = db.execute(text("SHOW COLUMNS FROM reports LIKE 'category'"))
        if report_category.fetchone() is None:
            db.execute(text("ALTER TABLE reports ADD COLUMN category VARCHAR(100) NULL"))

        report_columns = db.execute(text("SHOW COLUMNS FROM reports LIKE 'student_id'"))
        report_student_column = report_columns.fetchone()
        if report_student_column is not None and str(report_student_column[2]).upper() == "NO":
            db.execute(text("ALTER TABLE reports MODIFY COLUMN student_id VARCHAR(50) NULL"))

        report_foreign_keys = inspect(db.bind).get_foreign_keys("reports")
        for foreign_key in report_foreign_keys:
            if foreign_key.get("constrained_columns") == ["student_id"] and foreign_key.get("name"):
                constraint_name = foreign_key["name"].replace("`", "``")
                db.execute(text(f"ALTER TABLE reports DROP FOREIGN KEY `{constraint_name}`"))
        db.execute(text(
            "ALTER TABLE reports ADD CONSTRAINT `fk_reports_student_id` "
            "FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE"
        ))

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


# ==========================================
# --- Authentication Endpoints ---
# ==========================================

# 1. የተማሪዎች ምዝገባ ኤፒአይ (POST /api/register)
@app.post("/api/register", status_code=status.HTTP_201_CREATED)
def register_student(student_data: StudentRegister, db: Session = Depends(get_db)):
    security = get_security_settings(db)
    minimum_password_length = security.min_password_length
    if len(student_data.password) < minimum_password_length:
        raise HTTPException(status_code=400, detail=f"Password must be at least {minimum_password_length} characters.")

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
        status="Pending Verification" if security.require_student_verification else "Active",
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)

    return {
        "message": "Registration submitted for verification." if security.require_student_verification else "Success",
        "user": {"name": db_student.name, "studentId": db_student.student_id},
        "requires_verification": security.require_student_verification,
    }


# 2. የጋራ የሎጊን ኤፒአይ ኤንድፖይንት (POST /api/login)
@app.post("/api/login")
def login_user(data: LoginRequest, db: Session = Depends(get_db)):
    security = get_security_settings(db)
    identifier = _login_identifier(data.id_or_email)
    _check_login_lock(db, identifier, security)

    # 2.1 መጀመሪያ በአስተዳዳሪ ሰንጠረዥ ይፈትሻል
    admin = db.query(Admin).filter(
        (Admin.username == data.id_or_email) | (Admin.email == data.id_or_email)
    ).first()
    
    if admin and verify_password(data.password, admin.password_hash):
        _reset_login_attempts(db, identifier)
        avatar_filename = f"{admin.username}.jpg"
        avatar_url = f"http://127.0.0.1:8000/static/uploads/avatars/{avatar_filename}"
        if not os.path.exists(os.path.join(AVATAR_DIR, avatar_filename)):
            avatar_url = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
        if security.admin_2fa:
            otp = f"{random.randint(100000, 999999)}"
            db.add(PasswordReset(
                email=admin.email,
                otp_code=otp,
                expires_at=datetime.utcnow() + timedelta(minutes=10),
                is_used=False,
            ))
            db.commit()
            email_sent = send_otp_email(admin.email, otp)
            if not email_sent:
                logging.getLogger(__name__).warning("Admin login OTP email could not be sent.")
            return {
                "role": "admin",
                "requires_2fa": True,
                "otp_email": admin.email,
                "message": "A verification code was sent to the administrator email.",
                "dev_mode": not email_sent,
            }
        session_secret = os.getenv("SESSION_SECRET", "campace-session-secret")
        token = _create_session_token(admin.username, "admin", security.session_timeout, session_secret)
        return {"role": "admin", "access_token": token, "user": {"name": admin.username, "username": admin.username, "email": admin.email, "avatarUrl": avatar_url}}

    if _setting_bool(_get_setting_value(db, "maintenance", "maintenanceMode", False)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_get_setting_value(
                db,
                "maintenance",
                "maintenanceMessage",
                "Marketplace maintenance in progress.",
            ),
        )

    # 2.2 ካልሆነ በተማሪዎች ሰንጠረዥ ይፈትሻል
    student = db.query(Student).filter(
        (Student.student_id == data.id_or_email) | (Student.email == data.id_or_email)
    ).first()
    
    if student and verify_password(data.password, student.password):
        if security.require_student_verification and not student.is_verified:
            _record_failed_login(db, identifier, security)
            raise HTTPException(status_code=403, detail="Student verification is required before login.")
        _reset_login_attempts(db, identifier)
        avatar_filename = f"{student.student_id}.jpg"
        avatar_url = f"http://127.0.0.1:8000/static/uploads/avatars/{avatar_filename}"
        if not os.path.exists(os.path.join(AVATAR_DIR, avatar_filename)):
            avatar_url = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
        session_secret = os.getenv("SESSION_SECRET", "campace-session-secret")
        token = _create_session_token(student.student_id, "student", security.session_timeout, session_secret)
        return {"role": "student", "access_token": token, "user": {"name": student.name, "studentId": student.student_id, "email": student.email, "avatarUrl": avatar_url, "is_verified": bool(student.is_verified)}}

    _record_failed_login(db, identifier, security)
    raise HTTPException(status_code=400, detail="Invalid ID/Email or Password.")


@app.post("/api/login/verify-otp")
def verify_admin_login_otp(request: AdminLoginOtpRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email.ilike(request.email.strip().lower())).first()
    if not admin:
        raise HTTPException(status_code=400, detail="Invalid or expired administrator verification code.")
    otp_record = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.email.ilike(admin.email),
            PasswordReset.otp_code == request.otp_code.strip(),
            PasswordReset.is_used == False,
            PasswordReset.expires_at >= datetime.utcnow(),
        )
        .order_by(PasswordReset.id.desc())
        .first()
    )
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired administrator verification code.")
    otp_record.is_used = True
    db.commit()
    token = _create_session_token(admin.username, "admin", _session_timeout_minutes(db), os.getenv("SESSION_SECRET", "campace-session-secret"))
    return {"role": "admin", "access_token": token, "user": {"name": admin.username, "username": admin.username, "email": admin.email}}

# 2.3 የይለፍ ቃል መርሻ ኮድ መላኪያ (POST /api/auth/forgot-password)
@app.post("/api/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = request.email.strip().lower()
    student = db.query(Student).filter(Student.email.ilike(email)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Email not found.")

    otp = f"{random.randint(100000, 999999)}"
    expires = datetime.utcnow() + timedelta(minutes=15)

    reset_entry = PasswordReset(
        email=email,
        otp_code=otp,
        expires_at=expires,
        is_used=False
    )
    db.add(reset_entry)
    try:
        email_sent = send_otp_email(email, otp)
        if not email_sent:
            print(f"[DEV BYPASS] SMTP Connection failed! Captured OTP for {email}: {otp}", flush=True)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create password reset request.")
    return {
        "message": "Verification code has been sent to your email." if email_sent else "SMTP unavailable. Use the captured development OTP in the server console.",
        "success": True,
        "dev_mode": not email_sent,
    }


@app.post("/api/auth/verify-reset-code")
def verify_reset_code(request: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    email = request.email.strip().lower()
    otp = request.otp_code.strip()
    if not otp.isdigit() or len(otp) != 6:
        raise HTTPException(status_code=400, detail="Invalid OTP format.")

    reset_record = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.email.ilike(email),
            PasswordReset.otp_code == otp,
            PasswordReset.is_used == False,
            PasswordReset.expires_at >= datetime.utcnow(),
        )
        .order_by(PasswordReset.id.desc())
        .first()
    )
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    return {"message": "Verification code is valid.", "success": True}


# 2.5 አዲስ የይለፍ ቃል መቀየሪያ (POST /api/auth/reset-password)
@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = request.email.strip().lower()
    otp = request.otp_code.strip()
    new_password = request.new_password

    if not otp.isdigit() or len(otp) != 6:
        raise HTTPException(status_code=400, detail="Invalid OTP format.")
    minimum_password_length = _session_password_min_length(db)
    if len(new_password) < minimum_password_length or not re.search(r"[A-Z]", new_password) or not re.search(r"\d", new_password):
        raise HTTPException(status_code=400, detail=f"Password must be at least {minimum_password_length} characters and include an uppercase letter and a number.")

    reset_record = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.email.ilike(email),
            PasswordReset.otp_code == otp,
            PasswordReset.is_used == False,
            PasswordReset.expires_at >= datetime.utcnow()
        )
        .order_by(PasswordReset.id.desc())
        .first()
    )

    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    student = db.query(Student).filter(Student.email.ilike(email)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
        student.password = hash_password(new_password)
        reset_record.is_used = True
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reset password.")

    return {"message": "Password reset successful! You can now log in.", "success": True}


# ==========================================
# --- Admin Profile & Settings Endpoints ---
# ==========================================

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
    print(f"DEBUG update_admin_profile payload: {payload}", flush=True)
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
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".jfif"}
    filename = image.filename or ""
    extension = os.path.splitext(filename)[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only image files are allowed: jpg, jpeg, png, webp, jfif.")

    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    avatar_name = f"{admin.username}.jpg"
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
    response = json.loads(json.dumps(DEFAULT_SETTINGS_BLOCKS))
    grouped_keys = set(DEFAULT_SETTINGS_BLOCKS)
    for item in db.query(SystemSetting).filter(SystemSetting.key.in_(grouped_keys)).all():
        parsed = _parse_setting_value(item.value)
        if isinstance(parsed, dict):
            response[item.key].update(parsed)
            public_key = os.getenv("CHAPA_PUBLIC_KEY", "")
            secret_key = os.getenv("CHAPA_SECRET_KEY", "")
            response["payment"]["publicKey"] = f"{public_key[:8]}••••••" if public_key else "Not configured"
            response["payment"]["secretKey"] = "••••••••••••" if secret_key else "Not configured"
    return response


@app.put("/api/admin/settings")
def update_admin_settings(payload: dict, db: Session = Depends(get_db)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Settings payload must be a JSON object.")

    current = get_admin_settings(db)
    normalized = json.loads(json.dumps(DEFAULT_SETTINGS_BLOCKS))
    for block, values in payload.items():
        if block not in normalized:
            raise HTTPException(status_code=400, detail=f"Unknown settings block: {block}")
        if not isinstance(values, dict):
            raise HTTPException(status_code=400, detail=f"Settings block '{block}' must be an object.")
        normalized[block].update(values)

    payment_values = normalized["payment"]
    payment_values["paymentProvider"] = "Chapa"
    payment_values["currency"] = "ETB"
    payment_values["paymentVerification"] = "Automatic"
    if payment_values.get("refundPolicy") not in {"Admin approval required", "Automatic"}:
        raise HTTPException(status_code=400, detail="Invalid refund policy.")
    if payment_values.get("maximumRefund") not in {"100%", "75%", "50%"}:
        raise HTTPException(status_code=400, detail="Invalid maximum refund value.")
    if not isinstance(payment_values.get("enableOnlinePayment"), bool) or not isinstance(payment_values.get("refundsEnabled"), bool):
        raise HTTPException(status_code=400, detail="Payment toggles must be boolean values.")
    security_values = payment_values.get("security")
    if not isinstance(security_values, dict) or any(not isinstance(value, bool) for value in security_values.values()):
        raise HTTPException(status_code=400, detail="Payment security rules must be boolean values.")
    payment_values.pop("publicKey", None)
    payment_values.pop("secretKey", None)
    normalized["payment"] = payment_values

    normalized["general"]["currency"] = "ETB"
    normalized["general"]["timezone"] = "Africa/Addis_Ababa"

    for key, value in normalized.items():
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        serialized = json.dumps(value, ensure_ascii=False)
        if existing:
            existing.value = serialized
        else:
            db.add(SystemSetting(key=key, value=serialized))

    db.query(SystemSetting).filter(~SystemSetting.key.in_(normalized.keys())).delete(synchronize_session=False)

    admin = db.query(Admin).filter(Admin.username == "mau9999").first() or db.query(Admin).order_by(Admin.id.asc()).first()
    audit_current = json.loads(json.dumps(current))
    audit_current.get("payment", {}).pop("publicKey", None)
    audit_current.get("payment", {}).pop("secretKey", None)
    changes = _settings_change_details(audit_current, normalized)
    if admin and changes:
        db.add(AuditLog(
            admin_id=admin.id,
            action="System Settings Updated",
            entity_type="Settings",
            entity_id=1,
            description=json.dumps({
                "username": admin.username,
                "old_values": audit_current,
                "new_values": normalized,
                "changes": changes,
            }, ensure_ascii=False),
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))
    db.commit()

    return {"success": True, "message": "Settings saved successfully", "settings": normalized, "changes": changes}


@app.patch("/api/admin/settings/{id}")
def update_setting_patch(id: int, data: SettingUpdate):
    return {"message": "Setting updated successfully"}


@app.post("/api/admin/payments/test-connection")
def test_chapa_connection(db: Session = Depends(get_db)):
    public_key = os.getenv("CHAPA_PUBLIC_KEY", "")
    secret_key = os.getenv("CHAPA_SECRET_KEY", "")
    connected = bool(public_key and secret_key)
    admin = db.query(Admin).filter(Admin.username == "mau9999").first() or db.query(Admin).order_by(Admin.id.asc()).first()
    if admin:
        db.add(AuditLog(
            admin_id=admin.id,
            action="Payment Connection Tested",
            entity_type="Payment Configuration",
            entity_id=1,
            description=f"Admin {admin.username} tested Chapa connection; result={'connected' if connected else 'not configured'}.",
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))
        db.commit()

    return {"success": connected, "provider": "Chapa", "status": "Connected" if connected else "Not configured"}


@app.get("/api/admin/settings/{id}")
def get_setting_by_id(id: int):
    return {"id": id, "value": True, "message": "Setting retrieved successfully"}


@event.listens_for(Session, "before_flush")
def enforce_audit_log_append_only(session, flush_context, instances):
    new_audit_logs = [item for item in session.new if isinstance(item, AuditLog)]
    if new_audit_logs:
        setting_row = session.connection().execute(
            text("SELECT value FROM system_settings WHERE `key` = 'security'")
        ).scalar()
        security_settings = _parse_setting_value(setting_row)
        audit_logging_enabled = _setting_bool(
            security_settings.get("auditLogging") if isinstance(security_settings, dict) else None,
            DEFAULT_SETTINGS_BLOCKS["security"]["auditLogging"],
        )
        if not audit_logging_enabled:
            for audit_log in new_audit_logs:
                session.expunge(audit_log)

    deleted_logs = [item for item in session.deleted if isinstance(item, AuditLog)]
    updated_logs = [
        item for item in session.dirty
        if isinstance(item, AuditLog) and session.is_modified(item, include_collections=False)
    ]

    if deleted_logs:
        for audit_log in deleted_logs:
            with engine.begin() as connection:
                connection.execute(text(
                    "INSERT INTO audit_logs "
                    "(admin_id, action, entity_type, entity_id, description, status, severity, ip_address) "
                    "VALUES (:admin_id, :action, :entity_type, :entity_id, :description, :status, :severity, :ip_address)"
                ), {
                    "admin_id": audit_log.admin_id,
                    "action": "DELETE_AUDIT_LOG_ATTEMPT",
                    "entity_type": "AuditLog",
                    "entity_id": audit_log.id,
                    "description": f"Blocked deletion attempt for audit log {audit_log.id}.",
                    "status": "BLOCKED",
                    "severity": "critical",
                    "ip_address": None,
                })
        raise HTTPException(status_code=403, detail="Audit logs are append-only and cannot be deleted.")

    if updated_logs:
        raise HTTPException(status_code=403, detail="Audit logs are append-only and cannot be updated.")


@event.listens_for(engine, "before_cursor_execute", retval=True)
def block_raw_audit_log_mutations(connection, cursor, statement, parameters, context, executemany):
    mutation_match = re.match(r"\s*(DELETE\s+FROM|UPDATE)\s+[`\"]?audit_logs[`\"]?\b", statement, re.IGNORECASE)
    if not mutation_match:
        return statement, parameters

    if mutation_match.group(1).upper().startswith("DELETE"):
        with engine.begin() as audit_connection:
            audit_connection.execute(text(
                "INSERT INTO audit_logs "
                "(action, entity_type, description, status, severity) "
                "VALUES (:action, :entity_type, :description, :status, :severity)"
            ), {
                "action": "DELETE_AUDIT_LOG_ATTEMPT",
                "entity_type": "AuditLog",
                "description": "Blocked raw SQL deletion attempt against the audit_logs table.",
                "status": "BLOCKED",
                "severity": "critical",
            })
        raise HTTPException(status_code=403, detail="Audit logs are append-only and cannot be deleted.")

    raise HTTPException(status_code=403, detail="Audit logs are append-only and cannot be updated.")


@app.get("/api/admin/audit-logs")
def get_admin_audit_logs(
    search: Optional[str] = None,
    action_type: Optional[str] = None,
    status: Optional[str] = None,
    admin_username: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    try:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
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

        if admin_username and admin_username.strip():
            query = query.filter(Admin.username.ilike(admin_username.strip()))
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        total = query.count()
        logs = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit).all()

        results = []
        for log in logs:
            action_label = log.action or "System Event"
            status_value = (log.status or "SUCCESS").upper()
            severity = log.severity or ("success" if status_value == "SUCCESS" else "warning" if status_value in {"WARNING", "PENDING"} else "critical")
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

        return {"items": results, "total": total, "limit": limit, "offset": offset}
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


# ==========================================
# --- Student Profile & Notifications ---
# ==========================================

# 2.1 የተማሪ ፕሮፋይል ፎቶ ማስገባት (POST /api/student/upload-avatar)
@app.post("/api/student/upload-avatar")
async def upload_student_avatar(
    student_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".jfif"}
    filename = image.filename or ""
    extension = os.path.splitext(filename)[1].lower()

    if extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only image files are allowed: jpg, jpeg, png, webp, jfif.")

    validated_student_id = _validate_student_id(db, student_id)
    student = db.query(Student).filter(Student.student_id == validated_student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    os.makedirs(AVATAR_DIR, exist_ok=True)
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
    return {"success": True, "imageUrl": image_url, "avatarUrl": image_url}


@app.get("/api/student/profile")
def get_student_profile(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    return {
        "success": True,
        "user": {
            "name": student.name,
            "studentId": student.student_id,
            "email": student.email,
            "phone": student.phone,
            "college": student.college,
            "department": student.department,
            "is_verified": bool(student.is_verified),
        },
    }


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
            "is_verified": bool(student.is_verified),
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
        db.query(Message.id)
        .filter(
            Message.receiver_id == student_id,
            Message.is_read.is_(False)
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


# ==========================================
# --- Categories & Locations ---
# ==========================================

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


# ==========================================
# --- Products Catalog & Seller Endpoints ---
# ==========================================

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

    if _setting_bool(_get_setting_value(db, "maintenance", "maintenanceMode", False)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_get_setting_value(
                db,
                "maintenance",
                "maintenanceMessage",
                "Marketplace maintenance in progress.",
            ),
        )

    query = db.query(Product).filter(Product.status.ilike("Approved"))
    auto_hide_sold = _setting_bool(
        _get_setting_value(
            db,
            "marketplace",
            "autoHideSold",
            DEFAULT_SETTINGS_BLOCKS["marketplace"]["autoHideSold"],
        ),
        DEFAULT_SETTINGS_BLOCKS["marketplace"]["autoHideSold"],
    )
    if auto_hide_sold:
        query = query.filter(Product.status != "Sold")

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
    """Fetch details for a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    seller = None
    if product.seller:
        seller = db.query(Student).filter(
            or_(Student.student_id == product.seller, Student.name == product.seller)
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
        "seller_phone": seller.phone if seller else None,
        "seller_name": seller.name if seller else product.seller,
        "seller_dept": seller.department if seller else None,
        "status": product.status,
        "created_at": product.created_at,
    }


# 4.1. አዲስ ተለጠፈ እቃ በተማሪ ወይም ሻጭ የሚፈጠር ኤፒአይ (POST /api/products)
# 4.1. አዲስ ተለጠፈ እቃ በተማሪ ወይም ሻጭ የሚፈጠር ኤፒአይ (POST /api/products)
@app.post("/api/products", status_code=status.HTTP_201_CREATED)
def create_product(
    title: str = Form(...),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    price: str = Form(...),
    description: Optional[str] = Form(None),
    seller: Optional[str] = Form(None),
    student_id: Optional[str] = Form(None),  # <-- ADDED: Capture student_id from frontend Form
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db)
):
    """
    ተለጠፈ እቃ ፈጠር - ተማሪ ወይም ሻጭ አዲስ ምርት ሊለጥፉ ይችላሉ።
    """
    try:
        require_student_verification = get_security_settings(db).require_student_verification
        title_value = str(title or "").strip()
        price_value = str(price or "").strip()
        if not title_value:
            raise HTTPException(status_code=422, detail="Product title is required.")
        if not price_value:
            raise HTTPException(status_code=422, detail="Product price is required.")

        image_url = None
        max_images_per_product = _get_setting_value(
            db,
            "marketplace",
            "maxImagesPerProduct",
            DEFAULT_SETTINGS_BLOCKS["marketplace"]["maxImagesPerProduct"],
        )
        try:
            max_images_per_product = max(0, int(max_images_per_product))
        except (TypeError, ValueError):
            max_images_per_product = DEFAULT_SETTINGS_BLOCKS["marketplace"]["maxImagesPerProduct"]
        max_image_size = _get_setting_value(
            db,
            "marketplace",
            "maxImageSize",
            DEFAULT_SETTINGS_BLOCKS["marketplace"]["maxImageSize"],
        )

        if len(images) > max_images_per_product:
            raise HTTPException(
                status_code=400,
                detail=f"You can upload a maximum of {max_images_per_product} images per product.",
            )
        require_approval = _setting_bool(
            _get_setting_value(
                db,
                "marketplace",
                "requireApproval",
                DEFAULT_SETTINGS_BLOCKS["marketplace"]["requireApproval"],
            ),
            DEFAULT_SETTINGS_BLOCKS["marketplace"]["requireApproval"],
        )

        normalized_student_id = str(student_id).strip() if student_id else ""
        if normalized_student_id:
            student = db.query(Student).filter(Student.student_id == normalized_student_id).first()
            if not student:
                raise HTTPException(status_code=404, detail="Student not found.")
            if require_student_verification and not student.is_verified:
                raise HTTPException(
                    status_code=403,
                    detail="Unverified profiles are restricted from creating listings.",
                )
        
        # ስዕል ወደ ፋይል ያስቀምጡ (Save image if provided)
        image_urls = []
        for image in images:
            if not image.filename:
                continue

            allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.jfif'}
            file_ext = os.path.splitext(image.filename)[1].lower()
            
            if file_ext not in allowed_extensions:
                raise HTTPException(status_code=400, detail="Invalid image format. Allowed: jpg, jpeg, png, gif, webp, jfif")

            image.file.seek(0, os.SEEK_END)
            image_size = image.file.tell()
            image.file.seek(0)
            max_image_size_bytes = _parse_size_bytes(max_image_size)
            if image_size > max_image_size_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image size must not exceed {max_image_size}.",
                )
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_")
            unique_filename = timestamp + image.filename
            file_path = os.path.join(STATIC_DIR, unique_filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            
            image_urls.append(f"http://127.0.0.1:8000/static/uploads/{unique_filename}")

        image_url = json.dumps(image_urls, ensure_ascii=False) if image_urls else None
        
        # Resolve the seller's identity properly (የሻጩን ማንነት መፍታት)
        seller_value = str(seller).strip() if seller else ""
        if not seller_value and normalized_student_id:
            try:
                resolved_student_id = _validate_student_id(
                    db,
                    normalized_student_id,
                    field_name="student_id",
                )
                student = db.query(Student).filter(
                    Student.student_id == resolved_student_id
                ).first()
                if student:
                    seller_value = student.student_id
            except HTTPException:
                seller_value = ""
        
        # Fallback if no seller resolved
        if not seller_value:
            seller_value = "Unknown"

        # ምርት ወደ ዳታቤዝ ያስቀምጡ (Save product to database)
        db_product = Product(
            title=title_value,
            category=category,
            subcategory=subcategory,
            price=price_value,
            image=image_url,
            description=description,
            seller=seller_value,  # <-- Use resolved seller identity
            status="Pending" if require_approval else "Approved"
        )
        db_product.location = "Addis Ababa"
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        
        return {
            "success": True,
            "message": "Product posted successfully! Awaiting admin approval." if require_approval else "Product posted successfully!",
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


@app.put("/api/student/products/{product_id}")
def update_student_product(product_id: int, payload: StudentProductUpdate, db: Session = Depends(get_db)):
    """Update a seller's own product details or marketplace status."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    if str(payload.student_id).strip() != str(product.seller or "").strip():
        raise HTTPException(status_code=403, detail="You can only update your own products.")

    update_fields = {
        "title": payload.title,
        "category": payload.category,
        "subcategory": payload.subcategory,
        "price": payload.price,
        "description": payload.description,
        "status": payload.status,
    }
    for field_name, value in update_fields.items():
        if value is not None:
            setattr(product, field_name, value)

    db.commit()
    db.refresh(product)
    return {
        "success": True,
        "product": {
            "id": product.id,
            "title": product.title,
            "category": product.category,
            "subcategory": product.subcategory,
            "price": product.price,
            "description": product.description,
            "status": product.status,
            "image": product.image,
        },
    }
    
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
    """Return database-backed seller KPIs, alerts, listings, and received orders."""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    seller_filter = (Product.seller == student.student_id) | (Product.seller == student.name)

    listings = db.query(Product).filter(seller_filter).order_by(Product.created_at.desc()).all()
    received_orders = db.query(Order).join(Product, Order.product_id == Product.id).filter(
        (Product.seller == student.student_id) | (Product.seller == student.name)
    ).order_by(Order.created_at.desc()).all()

    listing_statuses = [str(listing.status or "Pending").strip().lower() for listing in listings]
    active_listings = sum(status in {"approved", "active"} for status in listing_statuses)
    pending_listings = sum(status in {"pending", "under review", "under_review"} for status in listing_statuses)
    sold_listings = sum(status == "sold" for status in listing_statuses)
    pending_orders = sum(str(order.status or "").strip().lower() in {"pending", "processing"} for order in received_orders)
    completed_orders = [
        order for order in received_orders
        if str(order.status or "").strip().lower() in {"completed", "successful", "delivered", "sold"}
    ]
    completed_revenue = sum(
        float(re.sub(r"[^0-9.]", "", str(order.price or "0")) or 0)
        for order in completed_orders
    )
    review_average = db.query(func.avg(Review.rating)).join(
        Order, Review.order_id == Order.id
    ).join(
        Product, Order.product_id == Product.id
    ).filter(
        seller_filter
    ).scalar()
    cancelled_orders = [
        order for order in received_orders
        if str(order.status or "").strip().lower() in {"cancelled", "canceled", "rejected"}
    ]
    resolved_orders = len(completed_orders) + len(cancelled_orders)
    order_completion = (len(completed_orders) / resolved_orders * 100) if resolved_orders else 0
    response_rate = (
        (len(received_orders) - len(cancelled_orders)) / len(received_orders) * 100
        if received_orders else 0
    )
    on_time_pickup = (len(completed_orders) / len(received_orders) * 100) if received_orders else 0

    return {
        "stats": {
            "total_listings": len(listings),
            "active_listings": active_listings,
            "pending_listings": pending_listings,
            "sold_listings": sold_listings,
            "received_orders": len(received_orders),
            "completed_revenue": completed_revenue,
            "pending_orders": pending_orders,
            "unapproved_products": pending_listings,
        },
        "alerts": {
            "pending_orders": pending_orders,
            "unapproved_products": pending_listings,
        },
        "performance": {
            "rating": round(float(review_average or 0), 1),
            "response_rate": round(response_rate, 1),
            "order_completion": round(order_completion, 1),
            "on_time_pickup": round(on_time_pickup, 1),
        },
        "my_listings": [
            {
                "id": listing.id,
                "title": listing.title,
                "category": listing.category,
                "price": listing.price,
                "image": listing.image,
                "status": listing.status,
                "created_at": listing.created_at,
            }
            for listing in listings
        ],
        "received_orders": [
            {
                "id": o.id,
                "title": o.title,
                "price": o.price,
                "status": o.status,
                "buyer_id": o.student_id,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "Recent"
            }
            for o in received_orders
        ]
    }


# ==========================================
# --- AI Chat & Advisor Functions ---
# ==========================================

@app.post("/api/ai/translate")
def ai_translate(request: AITranslateRequest):
    """Translate user-facing database text between English and Amharic."""
    source_text = request.text.strip()
    target_language = request.target_language.strip().lower()

    if not source_text:
        raise HTTPException(status_code=400, detail="Text is required.")
    if target_language not in {"am", "en"}:
        raise HTTPException(status_code=400, detail="Target language must be 'am' or 'en'.")

    try:
        translated_text = GoogleTranslator(source="auto", target=target_language).translate(source_text)
    except Exception as error:
        logging.getLogger("ai_translation").exception("Translation provider failed: %s", error)
        raise HTTPException(status_code=502, detail="Translation service is temporarily unavailable.") from error

    return {
        "source_text": source_text,
        "translated_text": translated_text,
        "target_language": target_language,
    }

# --- 5. የ Jiji-style የዳታቤዝ AI አማካሪ ቻት ኤንድፖይንት (POST /api/ai/chat) ---
@app.post("/api/ai/chat")
def ai_chat(chat_request: AIChatRequest, db: Session = Depends(get_db)):
    message = chat_request.message.strip().lower()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")

    # 5.1 ተጠቃሚው ስለ ላፕቶፕ ወይም ኮምፒውተር ከጠየቀ
    if "laptop" in message or "computer" in message or "pc" in message:
        db_products = db.query(Product).filter(
            (Product.category.ilike("%electronics%")) | 
            (Product.title.ilike("%laptop%")) | 
            (Product.title.ilike("%computer%"))
        ).limit(3).all()
        
        if db_products:
            reply = "I searched our MySQL database in real-time and found these laptops currently listed by students:\n\n"
            for p in db_products:
                desc = (p.description or "")[:100]
                reply += f"📍 **{p.title}** — **{p.price}**\n👤 Seller: {p.seller}\n📝 Description: {desc}...\n\n"
            reply += "You can browse these directly under the 'Electronics' directory on your home page!"
        else:
            reply = "I checked our MySQL database, but there are currently no laptops listed by students. You can be the first to list one in the 'Seller Hub'!"
            
    # 5.2 ተጠቃሚው ስለ መማሪያ መጻሕፍት ከጠየቀ
    elif "book" in message or "calculus" in message or "textbook" in message or "math" in message:
        db_products = db.query(Product).filter(
            (Product.category.ilike("%books%")) | 
            (Product.title.ilike("%book%")) |
            (Product.title.ilike("%textbook%"))
        ).limit(3).all()
        
        if db_products:
            reply = "Here are the academic textbooks currently listed in our database:\n\n"
            for p in db_products:
                desc = (p.description or "")[:100]
                reply += f"📖 **{p.title}** — **{p.price}**\n📝 Description: {desc}...\n\n"
        else:
            reply = "I couldn't find any academic books listed in our database at this moment. Graduating students usually upload them soon!"
            
    # 5.3 አጠቃላይ መረጃዎች
    else:
        reply = (
            "I’m your Campus AI assistant. Ask me about textbooks, gadget pricing, or campus trading tips. "
            "Try questions like ‘Which calculus book should I buy?’ or ‘How much should I sell a laptop for?’"
        )

    return {"reply": reply}


def detect_intent(message: str) -> str:
    message_lower = message.lower()
    sell_keywords = ['sell', 'price', 'how much', 'worth', 'cost', 'value', 'should i sell', 
                     'selling', 'what price', 'rate', 'negotiat', 'bid', 'offer']
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


def extract_search_keywords(message: str) -> List[str]:
    stopwords = {'the', 'a', 'an', 'and', 'or', 'is', 'are', 'for', 'to', 'from', 
                 'in', 'on', 'under', 'over', 'should', 'i', 'me', 'my', 'etb', 
                 'birr', 'how', 'much', 'sell', 'buy', 'find', 'show', 'list'}
    words = re.findall(r'\b[a-zA-Z0-9]+\b', message.lower())
    keywords = [w for w in words if w not in stopwords and len(w) > 2]
    return keywords


def extract_keywords(message: str) -> List[str]:
    """Backward-compatible alias for existing advisor helpers."""
    return extract_search_keywords(message)


def calculate_tf_idf_similarity(query: str, products: List[Product]) -> List[Tuple[Product, float]]:
    """Rank products by TF-IDF cosine similarity against the user's query."""
    if not products:
        return []
    
    product_texts = [f"{p.title or ''} {p.description or ''} {p.category or ''} {p.subcategory or ''}" for p in products]
    
    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), lowercase=True)
        vectors = vectorizer.fit_transform([query] + product_texts)
        similarities = cosine_similarity(vectors[0:1], vectors[1:]).flatten()
        scored_products = list(zip(products, similarities))
        scored_products.sort(key=lambda x: x[1], reverse=True)
        return scored_products
    except Exception as e:
        logging.error(f"TF-IDF calculation error: {str(e)}")
        return [(p, 0.5) for p in products]


def search_products_by_intent(db: Session, message: str, intent: str, department: str = None) -> List[Product]:
    try:
        keywords = extract_search_keywords(message)
        query = db.query(Product).filter(Product.status == 'Approved')
        
        if keywords:
            keyword_filters = []
            for keyword in keywords[:5]:
                keyword_filters.append(Product.title.ilike(f"%{keyword}%"))
                keyword_filters.append(Product.description.ilike(f"%{keyword}%"))
                keyword_filters.append(Product.category.ilike(f"%{keyword}%"))
                keyword_filters.append(Product.subcategory.ilike(f"%{keyword}%"))
            query = query.filter(or_(*keyword_filters))
        
        products = query.order_by(Product.created_at.desc()).limit(30).all()
        
        if products and keywords:
            query_text = ' '.join(keywords)
            ranked = calculate_tf_idf_similarity(query_text, products)
            return [p for p, score in ranked if score > 0.05][:10]
        
        return products[:10]
    except Exception as e:
        logging.error(f"Product search error: {str(e)}")
        return []


def calculate_price_recommendation(db: Session, keywords: List[str]) -> Dict:
    try:
        similar_products = db.query(Product).filter(
            Product.status.in_(['Approved', 'Sold', 'Active'])
        ).all()
        
        if keywords and similar_products:
            scored = calculate_tf_idf_similarity(' '.join(keywords), similar_products)
            similar_products = [p for p, score in scored if score > 0.05][:20]
        
        if not similar_products:
            return {
                "status": "no_data",
                "message": "Not enough similar products in database to calculate recommendation.",
                "suggestion": "Try listing at a competitive price based on product condition and market demand."
            }
        
        prices = []
        for p in similar_products:
            val = _parse_price_to_etb(p.price)
            if val > 0:
                prices.append(val)
        
        if not prices:
            return {
                "status": "no_data",
                "message": "Unable to extract pricing data for similar products.",
                "suggestion": "Check market listings for manual price estimation."
            }
        
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)
        
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
                "Condition matters: Excellent condition justifies higher prices",
                "Demand: High-demand items (laptops, books) sell faster at premium",
                "Timing: Semester start/exams increase demand for study materials",
                "Negotiation: Leave 10-15% room for buyer negotiation",
                f"Competitiveness: Current market average is {int(avg_price):,} ETB"
            ]
        }
    except Exception as e:
        logging.error(f"Price calculation error: {str(e)}")
        return {"status": "error", "message": "Error calculating price recommendation."}


def format_products_for_response(products: List[Product]) -> str:
    if not products:
        return ""
    product_cards = []
    for p in products:
        product_string = f"[PRODUCT:{p.id}:{p.title}:{p.price}]"
        product_cards.append(product_string)
    return "\n".join(product_cards)


def _openai_advisor_response(
    request: AIAdvisorRequest,
    message: str,
    intent: str,
    products: List[Product],
    price_data: Optional[Dict] = None,
) -> Optional[Dict[str, Any]]:
    """Ask OpenAI for a response when configured; return None to use the local fallback."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI

        product_context = "\n".join(
            f"id={product.id}; title={product.title}; category={product.category}; "
            f"price={product.price}; description={product.description or ''}"
            for product in products
        ) or "No approved products matched the request."
        pricing_context = json.dumps(price_data or {}, default=str)
        system_prompt = (
            "You are Campus AI Advisor for a student marketplace. Use only the supplied "
            "database context for product facts and prices. Be concise and helpful. "
            "For buying requests, include one exact marker per matching listing in the "
            "format [PRODUCT:id:title:price]. For selling requests, explain the market "
            "average and recommended range using the supplied pricing context."
        )
        user_prompt = (
            f"Student department: {request.department or 'Not provided'}\n"
            f"Intent: {intent}\n"
            f"User message: {message}\n\n"
            f"Approved product context:\n{product_context}\n\n"
            f"Local pricing context:\n{pricing_context}"
        )
        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        reply = (completion.choices[0].message.content or "").strip()
        if not reply:
            return None

        if intent == "buy" and products and "[PRODUCT:" not in reply:
            reply = f"{format_products_for_response(products)}\n\n{reply}"

        return {
            "reply": reply,
            "products": [{"id": product.id, "title": product.title, "price": product.price} for product in products],
            "intent": intent,
            "message_type": "openai_advisor",
            "provider": "openai",
        }
    except Exception as error:
        logging.getLogger("ai_advisor").warning("OpenAI advisor unavailable; using local fallback: %s", error)
        return None


@app.post("/api/ai/advisor")
def ai_advisor(request: AIAdvisorRequest, db: Session = Depends(get_db)):
    """Return database-backed product search or pricing guidance for the AI Advisor."""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")
    
    logger = logging.getLogger("ai_advisor")
    logger.info(f"[AI ADVISOR] Query from {request.student_id}: {message[:100]}")
    
    try:
        intent = detect_intent(message)
        keywords = extract_search_keywords(message)
        cloud_products = search_products_by_intent(db, message, intent, request.department) if intent == "buy" else db.query(Product).filter(Product.status == "Approved").order_by(Product.created_at.desc()).limit(30).all()
        local_price_data = calculate_price_recommendation(db, keywords) if intent == "sell" else None
        cloud_response = _openai_advisor_response(request, message, intent, cloud_products, local_price_data)
        if cloud_response:
            return cloud_response
        
        if intent == 'buy':
            products = search_products_by_intent(
                db=db,
                message=message,
                intent=intent,
                department=request.department
            )
            
            if products:
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
        
        elif intent == 'sell':
            price_data = calculate_price_recommendation(db, keywords)
            
            if price_data.get("status") == "success":
                tips_list = "\n".join(f"- {tip}" for tip in price_data.get('tips', []))
                reply = f"""💰 **AI Price Recommendation for Your Sale**

Based on analysis of {price_data['similar_products_analyzed']} similar products in our marketplace:

**📊 Recommended Price Range: {price_data['price_range']}**
- Market Average: {price_data['average_market_price']:,} ETB
- Market Range: {price_data['market_min']:,} - {price_data['market_max']:,} ETB

**🎯 Seller Tips:**
{tips_list}

**Pro Tips for Your Listing:**
✅ Take clear, well-lit photos from multiple angles
✅ Write detailed description (condition, age, any defects)
✅ Mention warranty if applicable
✅ Respond quickly to inquiries - speeds up sales
✅ Consider offering delivery options for extra convenience

Ready to list? Head to Seller Hub to post your item! 📱"""
                
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


# ==========================================
# --- Student Support, Activity, Feeds ---
# ==========================================

# 5. ተማሪዎች አዲስ ቅሬታ ወይም የድጋፍ ፎርም የሚልኩበት ኤፒአይ (POST /api/student/report)
@app.post("/api/student/report", status_code=status.HTTP_201_CREATED)
def create_report(report_data: ReportCreate, db: Session = Depends(get_db)):
    try:
        provided_student_id = report_data.student_id.strip() if report_data.student_id else None
        student = None
        if provided_student_id:
            student = db.query(Student).filter(Student.student_id == provided_student_id).first()

        db_report = Report(
            student_id=student.student_id if student else None,
            student_name=report_data.student_name.strip(),
            email=report_data.email.strip() if report_data.email else None,
            category=report_data.category.strip() if report_data.category else None,
            issue=report_data.issue.strip(),
            status="Open"
        )
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return {
            "message": "Support ticket created successfully.",
            "ticket_reference": f"RPT-{db_report.id:04d}",
            "report": {
                "id": db_report.id,
                "student_id": db_report.student_id,
                "student_name": db_report.student_name,
                "email": db_report.email,
                "category": db_report.category,
                "issue": db_report.issue,
                "status": db_report.status,
                "created_at": db_report.created_at.isoformat() if db_report.created_at else None,
            },
        }
    except Exception as error:
        db.rollback()
        logger.exception("Failed to create support report: %s", error)
        raise HTTPException(status_code=500, detail="Could not create support ticket.") from error


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

    ai_enabled = _setting_bool(
        _get_setting_value(db, "ai", "enableAI", DEFAULT_SETTINGS_BLOCKS["ai"]["enableAI"]),
        DEFAULT_SETTINGS_BLOCKS["ai"]["enableAI"],
    )
    if not ai_enabled:
        return []

    try:
        num_recommendations = max(0, int(_get_setting_value(
            db,
            "ai",
            "numRecommendations",
            DEFAULT_SETTINGS_BLOCKS["ai"]["numRecommendations"],
        )))
    except (TypeError, ValueError):
        num_recommendations = DEFAULT_SETTINGS_BLOCKS["ai"]["numRecommendations"]

    try:
        min_similarity_score = float(_get_setting_value(
            db,
            "ai",
            "minSimilarityScore",
            DEFAULT_SETTINGS_BLOCKS["ai"]["minSimilarityScore"],
        ))
    except (TypeError, ValueError):
        min_similarity_score = DEFAULT_SETTINGS_BLOCKS["ai"]["minSimilarityScore"]

    if num_recommendations == 0:
        return []

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
        similarity = _cosine_similarity(profile_vector, vectors[idx]) if idx < len(vectors) else 0.0
        scored_products.append({
            "product": product,
            "score": similarity,
        })

    scored_products.sort(key=lambda item: item["score"], reverse=True)
    best_matches = []
    seen_ids = set()
    for item in scored_products:
        product = item["product"]
        if item["score"] < min_similarity_score:
            continue
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
        if len(best_matches) >= num_recommendations:
            break

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


# ==========================================
# --- Real-Time Chat & Messaging ---
# ==========================================

@app.get("/api/student/messages/conversations")
def get_student_conversations(student_id: str, db: Session = Depends(get_db)):
    """Fetch all unique conversation partners with details, last message, unread count."""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
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
    """Return the chronological direct-message history for two students."""
    sender_id = _validate_student_id(db, sender_id, field_name="sender_id")
    receiver_id = _validate_student_id(db, receiver_id, field_name="receiver_id")
    if sender_id == receiver_id:
        raise HTTPException(status_code=400, detail="sender_id and receiver_id must be different.")

    sender = db.query(Student).filter(Student.student_id == sender_id).first()
    receiver = db.query(Student).filter(Student.student_id == receiver_id).first()
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
        chat_messages = db.query(Message).filter(
            or_(
                (Message.sender_id == sender_id) & (Message.receiver_id == receiver_id),
                (Message.sender_id == receiver_id) & (Message.receiver_id == sender_id),
            )
        ).order_by(Message.created_at.asc()).all()

        unread_message_ids = [
            message.id for message in chat_messages
            if message.sender_id == receiver_id and not message.is_read
        ]
        if unread_message_ids:
            db.query(Message).filter(Message.id.in_(unread_message_ids)).update(
                {Message.is_read: True},
                synchronize_session=False
            )
            db.commit()

        formatted_messages = []
        for message in chat_messages:
            formatted_messages.append({
                "id": message.id,
                "sender_id": message.sender_id,
                "receiver_id": message.receiver_id,
                "product_id": message.product_id,
                "reply_to_id": message.reply_to_id,
                "message_text": message.message_text,
                "attachment_url": message.attachment_url,
                "attachment_type": message.attachment_type,
                "is_read": bool(message.is_read),
                "created_at": message.created_at.isoformat() if message.created_at else None,
            })

        return formatted_messages
    except Exception as e:
        db.rollback()
        logging.error(f"Error fetching chat history {sender_id}-{receiver_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history.")


@app.delete("/api/student/messages/{message_id}")
def delete_student_message(message_id: int, student_id: str, db: Session = Depends(get_db)):
    """Delete a message only when the requesting student sent it."""
    validated_student_id = _validate_student_id(db, student_id, field_name="student_id")
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")
    if message.sender_id != validated_student_id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    db.delete(message)
    db.commit()
    return {"success": True, "message": "Message deleted successfully."}


@app.post("/api/student/chat/upload-attachment")
async def upload_chat_attachment(file: UploadFile = File(...)):
    """Store a chat attachment and return its public static URL."""
    content_type = (file.content_type or "").lower()
    media_type = next((kind for kind in ("image", "audio", "video") if content_type.startswith(f"{kind}/")), None)
    if not media_type:
        guessed_type = mimetypes.guess_type(file.filename or "")[0] or ""
        media_type = next((kind for kind in ("image", "audio", "video") if guessed_type.startswith(f"{kind}/")), None)
    if not media_type:
        raise HTTPException(status_code=400, detail="Only image, audio, and video attachments are supported.")

    extension = os.path.splitext(file.filename or "")[1].lower()
    if not extension:
        extension = mimetypes.guess_extension(content_type) or ""
    attachment_name = f"{uuid.uuid4().hex}{extension}"
    attachment_path = os.path.join(ATTACHMENT_DIR, attachment_name)
    try:
        with open(attachment_path, "wb") as output_file:
            shutil.copyfileobj(file.file, output_file)
    except OSError as exc:
        logging.error("Failed to save chat attachment: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save attachment.")
    finally:
        await file.close()

    return {
        "attachment_url": f"http://127.0.0.1:8000/static/uploads/attachments/{attachment_name}",
        "attachment_type": media_type,
    }


@app.websocket("/api/student/chat/ws/{student_id}")
async def student_chat_websocket(websocket: WebSocket, student_id: str):
    """WebSocket endpoint for real-time P2P messaging."""
    db = SessionLocal()
    logger = logging.getLogger("websocket_chat")
    
    try:
        student = db.query(Student).filter(Student.student_id == student_id).first()
        if not student:
            await websocket.close(code=1008, reason="Student not found")
            logger.warning(f"[WS SECURITY] Invalid student_id: {student_id}")
            return
        if not student.is_verified:
            await websocket.close(code=1008, reason="ID verification is required to start a chat")
            logger.warning(f"[WS SECURITY] Unverified student chat blocked: {student_id}")
            return

        await manager.connect(student_id, websocket, student_name=student.name)
        logger.info(f"[WS CONNECT] {student_id} ({student.name}) connected. Online: {manager.get_online_count()}")
        await manager.broadcast({
            "type": "online_status",
            "student_id": student_id,
            "status": "online",
        }, exclude_student_id=student_id)

        while True:
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

            if payload.get("type") in {"typing", "user_typing"}:
                receiver_id = str(payload.get("receiver_id", "")).strip()
                if receiver_id and receiver_id != student_id:
                    await manager.send_personal_message(receiver_id, {
                        "type": "typing",
                        "sender_id": student_id,
                        "is_typing": payload.get("is_typing", payload.get("typing", False)) is not False,
                    })
                continue

            receiver_id = payload.get("receiver_id", "").strip()
            message_text = payload.get("message_text", "").strip()
            attachment_url = str(payload.get("attachment_url") or "").strip() or None
            attachment_type = str(payload.get("attachment_type") or "").strip().lower() or None
            reply_to_id = payload.get("reply_to_id")
            if attachment_type not in {"image", "audio", "video"}:
                attachment_type = None
            product_id = payload.get("product_id")

            if not receiver_id:
                await websocket.send_json({"success": False, "error": "receiver_id is required."})
                continue
            
            if not message_text and not attachment_url:
                await websocket.send_json({"success": False, "error": "message_text cannot be empty."})
                continue

            if attachment_url and not attachment_type:
                await websocket.send_json({"success": False, "error": "attachment_type is required for attachments."})
                continue
            
            if len(message_text) > 5000:
                logger.warning(f"[WS SECURITY] Message too long from {student_id}: {len(message_text)} chars")
                await websocket.send_json({"success": False, "error": "Message exceeds max length (5000)."})
                continue

            if student_id == receiver_id:
                await websocket.send_json({"success": False, "error": "Cannot message yourself."})
                continue

            receiver = db.query(Student).filter(Student.student_id == receiver_id).first()
            if not receiver:
                await websocket.send_json({"success": False, "error": "Recipient not found."})
                continue

            if product_id is not None:
                try:
                    product_id = int(product_id)
                    product = db.query(Product).filter(Product.id == product_id).first()
                    if not product:
                        await websocket.send_json({"success": False, "error": "Product not found."})
                        continue
                except (ValueError, TypeError):
                    product_id = None

            if reply_to_id is not None:
                try:
                    reply_to_id = int(reply_to_id)
                    parent_message = db.query(Message).filter(Message.id == reply_to_id).first()
                    if not parent_message or not (
                        (parent_message.sender_id == student_id and parent_message.receiver_id == receiver_id)
                        or (parent_message.sender_id == receiver_id and parent_message.receiver_id == student_id)
                    ):
                        await websocket.send_json({"success": False, "error": "Reply target not found in this conversation."})
                        continue
                except (ValueError, TypeError):
                    reply_to_id = None

            try:
                db_message = Message(
                    sender_id=student_id,
                    receiver_id=receiver_id,
                    product_id=product_id,
                    message_text=message_text or "[Attachment]",
                    attachment_url=attachment_url,
                    attachment_type=attachment_type,
                    reply_to_id=reply_to_id,
                    is_read=False,
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)
            except Exception as exc:
                db.rollback()
                logger.error(f"[DB ERROR] Failed to save message from {student_id}: {str(exc)}")
                await websocket.send_json({"success": False, "error": "Failed to save message."})
                continue

            chat_payload = {
                "type": "incoming_message",
                "id": db_message.id,
                "sender_id": db_message.sender_id,
                "receiver_id": db_message.receiver_id,
                "product_id": db_message.product_id,
                "message_text": db_message.message_text,
                "attachment_url": db_message.attachment_url,
                "attachment_type": db_message.attachment_type,
                "reply_to_id": db_message.reply_to_id,
                "is_read": db_message.is_read,
                "created_at": db_message.created_at.isoformat() if hasattr(db_message.created_at, "isoformat") else str(db_message.created_at),
            }

            delivered = await manager.send_personal_message(receiver_id, chat_payload)

            await websocket.send_json({
                "success": True,
                "message": "Message sent",
                "data": chat_payload,
                "delivered_live": delivered,
            })

    except WebSocketDisconnect:
        logger.info(f"[WS DISCONNECT] {student_id} closed connection")
        await manager.disconnect(student_id)
        await manager.broadcast({
            "type": "online_status",
            "student_id": student_id,
            "status": "offline",
        }, exclude_student_id=student_id)
    except Exception as exc:
        logger.error(f"[WS FATAL ERROR] {student_id}: {str(exc)}", exc_info=True)
        try:
            await websocket.send_json({"success": False, "error": "WebSocket error"})
        except Exception:
            pass
        await manager.disconnect(student_id)
        await manager.broadcast({
            "type": "online_status",
            "student_id": student_id,
            "status": "offline",
        }, exclude_student_id=student_id)
    finally:
        if db:
            db.close()


@app.post("/api/student/messages/send")
def send_student_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    validated_sender_id = _validate_student_id(db, request.sender_id, field_name="sender_id")
    validated_receiver_id = _validate_student_id(db, request.receiver_id, field_name="receiver_id")
    sender = db.query(Student).filter(Student.student_id == validated_sender_id).first()
    receiver = db.query(Student).filter(Student.student_id == validated_receiver_id).first()
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Student not found.")
    if not sender.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verification is required to start a chat with other students.",
        )

    if validated_sender_id == validated_receiver_id:
        raise HTTPException(status_code=400, detail="Cannot send a message to yourself.")

    if not request.message_text or not request.message_text.strip():
        raise HTTPException(status_code=400, detail="Message text is required.")

    if len(request.message_text.strip()) > 5000:
        raise HTTPException(status_code=400, detail="Message exceeds the 5000 character limit.")

    if request.product_id is not None:
        product = db.query(Product).filter(Product.id == request.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")

    try:
        chat_message = Message(
            sender_id=validated_sender_id,
            receiver_id=validated_receiver_id,
            product_id=request.product_id,
            message_text=request.message_text.strip(),
            is_read=False,
        )
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
    except Exception:
        db.rollback()
        logging.exception("Failed to save message transaction")
        raise HTTPException(status_code=500, detail="Failed to save message.")

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
            "created_at": chat_message.created_at.isoformat() if chat_message.created_at else None,
        },
        "readReceiptUpdated": 0,
        "read_receipt_updated": 0,
    }


# ==========================================
# --- Wishlist, Cart, Orders & Payments ---
# ==========================================

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


@app.post("/api/student/wishlist", status_code=status.HTTP_201_CREATED)
def create_wishlist_item(wishlist_data: WishlistCreate, db: Session = Depends(get_db)):
    raw_student_id = wishlist_data.student_id
    normalized_student_id = str(raw_student_id).strip() if raw_student_id is not None else ""

    if not normalized_student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")

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


@app.delete("/api/student/wishlist/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_item(id: int, db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter(WishlistItem.id == id).first()
    if not item:
        return

    db.delete(item)
    db.commit()
    return


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


@app.delete("/api/student/cart/{item_id}")
def delete_cart_item(item_id: int, db: Session = Depends(get_db)):
    """Remove a specific item from student's cart."""
    item = db.query(CartItem).filter(CartItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found.")
    
    db.delete(item)
    db.commit()
    return {"message": "Cart item removed successfully.", "id": item_id}


@app.post("/api/student/cart/checkout")
def checkout_student_cart(data: CheckoutRequest, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    require_student_verification = get_security_settings(db).require_student_verification
    if require_student_verification and not student.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ID verification is required to complete purchases.",
        )

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
        product.status = "Sold"
        db.add(order)
        db.flush()
        if _notifications_enabled(db, "orderNotifs"):
            db.add(Notification(
                student_id=data.student_id,
                title="Order Placed",
                message=f"Your order for '{product.title}' has been placed successfully.",
                type="order",
                is_read=False,
            ))
            seller_student = db.query(Student).filter(
                (Student.student_id == product.seller) | (Student.name == product.seller)
            ).first() if product.seller else None
            if seller_student and seller_student.student_id != data.student_id:
                db.add(Notification(
                    student_id=seller_student.student_id,
                    title="New Order",
                    message=f"You received a new order for '{product.title}'.",
                    type="order",
                    is_read=False,
                ))
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
@app.post("/api/student/reviews")
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


@app.post("/api/payment/initialize")
async def initialize_payment(request: DepositRequest, db: Session = Depends(get_db)):
    """Initialize a payment / deposit gateway session for student wallet."""
    student = db.query(Student).filter(Student.student_id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    
    amount = float(request.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0.")

    amount_value = Decimal(str(amount))
    duplicate_cutoff = datetime.now() - timedelta(seconds=30)
    existing_transaction = (
        db.query(Transaction)
        .filter(
            Transaction.student_id == student.student_id,
            Transaction.type == "Wallet Deposit",
            Transaction.status == "Pending",
            Transaction.amount == amount_value,
            Transaction.created_at >= duplicate_cutoff,
        )
        .order_by(Transaction.created_at.desc())
        .first()
    )
    if existing_transaction:
        return {
            "status": "success",
            "message": "A matching wallet deposit is already being processed.",
            "checkout_url": None,
            "tx_ref": existing_transaction.tx_id,
            "transaction_id": existing_transaction.id,
        }
    
    tx_ref = f"TX-{uuid.uuid4().hex[:8].upper()}"

    secret = os.getenv("CHAPA_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Chapa payment is not configured.")

    name_parts = (student.name or "Student").strip().split(maxsplit=1)
    chapa_payload = {
        "amount": f"{amount:.2f}",
        "currency": "ETB",
        "email": request.email or student.email,
        "first_name": name_parts[0],
        "last_name": name_parts[1] if len(name_parts) > 1 else name_parts[0],
        "tx_ref": tx_ref,
        "callback_url": os.getenv("CHAPA_CALLBACK_URL", "http://127.0.0.1:8000/api/payment/webhook"),
        "return_url": os.getenv("CHAPA_RETURN_URL", "http://localhost:5173/"),
        "customization": {"title": "Campus Market Wallet Deposit"},
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.chapa.co/v1/transaction/initialize",
                headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
                json=chapa_payload,
            )
            response_payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Unable to initialize payment with Chapa: {exc}")

    response_data = response_payload.get("data") if isinstance(response_payload, dict) else None
    checkout_url = response_data.get("checkout_url") if isinstance(response_data, dict) else None
    if response.is_error or not checkout_url:
        detail = response_payload.get("message", "Chapa did not return a checkout URL.") if isinstance(response_payload, dict) else "Invalid Chapa response."
        raise HTTPException(status_code=502, detail=f"Unable to initialize payment with Chapa: {detail}")

    existing_transaction = (
        db.query(Transaction)
        .filter(
            Transaction.student_id == student.student_id,
            Transaction.type == "Wallet Deposit",
            Transaction.status == "Pending",
            Transaction.amount == amount_value,
            Transaction.created_at >= duplicate_cutoff,
        )
        .order_by(Transaction.created_at.desc())
        .first()
    )
    if existing_transaction:
        return {
            "status": "success",
            "message": "A matching wallet deposit is already being processed.",
            "checkout_url": None,
            "tx_ref": existing_transaction.tx_id,
            "transaction_id": existing_transaction.id,
        }

    transaction = Transaction(
        student_id=student.student_id,
        tx_id=tx_ref,
        type="Wallet Deposit",
        amount=Decimal(str(amount)),
        description=f"Chapa wallet deposit initiated for {student.student_id}",
        status="Pending"
    )
    db.add(transaction)
    db.commit()
    
    return {
        "status": "success",
        "message": "Payment initialized successfully.",
        "checkout_url": checkout_url,
        "tx_ref": tx_ref
    }


# ==========================================
# --- Admin KPI, Analytics, Management ---
# ==========================================

# 7. የአስተዳዳሪ ስታቲስቲክስ መግለጫ (GET /api/admin/kpis)
@app.get("/api/admin/kpis")
def get_admin_kpis(db: Session = Depends(get_db)):
    total_users = db.query(Student).count()
    active_listings = db.query(Product).count()
    revenue_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).scalar() or 0
    pending_reports = db.query(Report).filter(Report.status.ilike("Open")).count()

    return [
        {"label": "Total Users", "value": f"{total_users}", "change": "+4.7%"},
        {"label": "Active Listings", "value": f"{active_listings}", "change": "+2.1%"},
        {"label": "Total Revenue", "value": f"{float(revenue_total):,.2f} ETB", "change": "+5.2%"},
        {"label": "Pending Reports", "value": f"{pending_reports}", "change": "-8.3%"}
    ]


@app.get("/api/admin/ai-analytics")
def get_admin_ai_analytics(db: Session = Depends(get_db)):
    """Return live recommendation-model metrics and ranking insights."""
    major_tables = (
        Student, Category, SubCategory, Product, Admin, AuditLog, Report,
        Notification, Message, WishlistItem, CartItem, Order, Transaction,
        PasswordReset, SystemSetting, Review,
    )
    table_record_counts = {
        model.__tablename__: db.query(model).count() for model in major_tables
    }
    db_records = sum(table_record_counts.values())
    user_profiles = table_record_counts[Student.__tablename__]
    products_indexed = table_record_counts[Product.__tablename__]

    product_columns = {
        column["name"] for column in inspect(db.get_bind()).get_columns(Product.__tablename__)
    }
    has_product_views = "views" in product_columns
    clicks = 0
    if has_product_views:
        clicks = int(db.execute(text("SELECT COALESCE(SUM(views), 0) FROM products")).scalar() or 0)

    request_count = user_profiles
    ctr_percentage = round((clicks / request_count) * 100, 2) if request_count else 0
    completed_orders = db.query(Order).filter(Order.status.ilike("Completed")).count()
    precision_percentage = round((completed_orders / clicks) * 100, 2) if clicks else 0
    recall_percentage = round((completed_orders / request_count) * 100, 2) if request_count else 0

    approved_products = db.query(Product).filter(Product.status.ilike("Approved"))
    order_counts = dict(
        db.query(Order.product_id, func.count(Order.id))
        .filter(Order.status.ilike("Completed"))
        .group_by(Order.product_id)
        .all()
    )
    if has_product_views:
        approved_products = approved_products.order_by(text("views DESC"), Product.created_at.desc())
    else:
        approved_products = approved_products.order_by(Product.created_at.desc())

    top_products = []
    for product in approved_products.limit(5).all():
        product_views = int(db.execute(
            text("SELECT COALESCE(views, 0) FROM products WHERE id = :product_id"),
            {"product_id": product.id},
        ).scalar() or 0) if has_product_views else 0
        product_clicks = product_views
        product_conversions = int(order_counts.get(product.id, 0))
        top_products.append({
            "id": product.id,
            "product": product.title,
            "title": product.title,
            "views": product_views,
            "clicks": product_clicks,
            "conversion": round((product_conversions / product_clicks) * 100, 2) if product_clicks else 0,
        })

    category_rows = (
        db.query(Product.category, func.count(Product.id).label("product_count"))
        .filter(Product.status.ilike("Approved"))
        .group_by(Product.category)
        .order_by(func.count(Product.id).desc())
        .limit(5)
        .all()
    )
    total_approved = sum(int(product_count) for _, product_count in category_rows)
    category_performance = [
        {
            "label": category_name or "General",
            "value": round((int(product_count) / total_approved) * 100, 2) if total_approved else 0,
        }
        for category_name, product_count in category_rows
    ]

    newest_product = db.query(Product.created_at).order_by(Product.created_at.desc()).first()
    newest_product_at = newest_product[0] if newest_product else None
    freshness_is_stable = bool(
        newest_product_at and newest_product_at >= datetime.now() - timedelta(days=3)
    )

    lowest_category = (
        db.query(Product.category, func.count(Product.id).label("product_count"))
        .filter(Product.status.ilike("Approved"))
        .group_by(Product.category)
        .order_by(func.count(Product.id).asc(), Product.category.asc())
        .first()
    )
    lowest_category_name = (lowest_category[0] if lowest_category else None) or "General"
    lowest_category_count = int(lowest_category[1]) if lowest_category else 0
    low_confidence = lowest_category_count < 2

    ai_enabled = bool(_get_setting_value(db, "ai", "enableAI", DEFAULT_SETTINGS_BLOCKS["ai"]["enableAI"]))
    alerts = [
        {
            "title": "Recommendation freshness",
            "status": "STABLE" if freshness_is_stable else "CHECK",
            "type": "success" if freshness_is_stable else "warning",
            "description": (
                "Model updated successfully with the latest product catalog and clickstream data."
                if freshness_is_stable
                else "The product catalog has not received a fresh listing in the last 3 days."
            ),
        },
        {
            "title": "Low confidence cluster",
            "status": "CHECK" if low_confidence else "STABLE",
            "type": "warning" if low_confidence else "success",
            "description": (
                f"{lowest_category_name} subcategory still needs more behavioral signals for better ranking."
                if low_confidence
                else f"{lowest_category_name} has sufficient approved products for reliable ranking signals."
            ),
        },
        {
            "title": "Search relevance boosted",
            "status": "IMPROVED" if ai_enabled else "CHECK",
            "type": "info" if ai_enabled else "warning",
            "description": (
                "Cross-sell recommendations improved with AI-enabled relevance ranking."
                if ai_enabled
                else "AI relevance ranking is disabled in system settings."
            ),
        },
    ]

    return {
        "db_records": db_records,
        "user_profiles": user_profiles,
        "products_indexed": products_indexed,
        "clicks": clicks,
        "requests": request_count,
        "request_count": request_count,
        "ctr": ctr_percentage,
        "ctr_percentage": ctr_percentage,
        "purchase_conversions": completed_orders,
        "completed_orders": completed_orders,
        "precision": precision_percentage,
        "recall": recall_percentage,
        "top_products": top_products,
        "category_performance": category_performance,
        "alerts": alerts,
        "table_record_counts": table_record_counts,
    }


@app.get("/api/admin/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    total_students = db.query(Student).count()
    active_students = db.query(Student).filter(Student.status.ilike("Active")).count()
    total_products = db.query(Product).count()
    pending_products = db.query(Product).filter(Product.status.ilike("Pending")).count()
    total_orders = db.query(Order).count()
    completed_orders = db.query(Order).filter(Order.status.ilike("Completed")).count()
    revenue_total = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.status.ilike("Successful")
    ).scalar() or 0
    revenue_total = float(revenue_total)
    pending_reports = db.query(Report).filter(Report.status.ilike("Open")).count()

    product_status_rows = db.query(Product.status, func.count(Product.id)).group_by(Product.status).all()
    product_status_breakdown = {"Approved": 0, "Pending": 0, "Rejected": 0}
    for status_value, count in product_status_rows:
        normalized = (status_value or "").strip().title()
        if normalized in product_status_breakdown:
            product_status_breakdown[normalized] = int(count)

    def format_revenue(value: float) -> str:
        if value >= 1_000_000:
            return f"{value / 1_000_000:.1f}M ETB"
        if value >= 1_000:
            return f"{value / 1_000:.1f}K ETB"
        return f"{value:,.0f} ETB"

    college_rows = db.query(
        Student.college,
        func.count(Student.id).label("count")
    ).group_by(Student.college).order_by(func.count(Student.id).desc()).all()

    total_college_students = sum(int(count) for _, count in college_rows)
    college_activity = []
    for index, (college_name, count) in enumerate(college_rows):
        color_palette = ["bg-indigo-500", "bg-sky-500", "bg-teal-500", "bg-rose-500", "bg-amber-500", "bg-purple-500"]
        college_activity.append({
            "name": college_name or "Unknown",
            "value": int(count),
            "percentage": round((int(count) / total_college_students) * 100, 1) if total_college_students else 0,
            "color": color_palette[index % len(color_palette)]
        })

    category_rows = db.query(
        Product.category,
        func.count(Product.id).label("product_count")
    ).group_by(Product.category).order_by(func.count(Product.id).desc()).limit(5).all()

    top_category_rows = category_rows[:4]
    top_category_total = sum(int(product_count) for _, product_count in top_category_rows)
    categories = []
    category_colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"]
    for index, (category_name, product_count) in enumerate(top_category_rows):
        percentage = round((int(product_count) / top_category_total) * 100, 1) if top_category_total else 0
        categories.append({
            "name": category_name or "General",
            "product_count": int(product_count),
            "percentage": percentage,
            "color": category_colors[index]
        })

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

    status_counts = {
        "Completed": completed_orders,
        "Processing": db.query(Order).filter(Order.status.ilike("Processing")).count(),
        "Pending": db.query(Order).filter(Order.status.ilike("Pending")).count(),
    }
    status_total = sum(status_counts.values())
    status_colors = {"Completed": "#10b981", "Processing": "#3b82f6", "Pending": "#f59e0b"}
    status_distribution = [
        {
            "label": label,
            "count": count,
            "value": round((count / status_total) * 100, 1) if status_total else 0,
            "color": status_colors[label],
        }
        for label, count in status_counts.items()
    ]

    trend_months = []
    user_growth = []
    product_uploads = []
    revenue_trend = []
    current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for month_offset in range(5, -1, -1):
        month_index = current_month.month - month_offset
        year = current_month.year + (month_index - 1) // 12
        month = (month_index - 1) % 12 + 1
        target_date = datetime(year, month, 1)
        next_month = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)

        trend_months.append(target_date.strftime("%b %y"))
        user_growth.append(0)
        product_uploads.append(db.query(Product).filter(
            Product.created_at >= target_date,
            Product.created_at < next_month,
        ).count())
        monthly_revenue = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.created_at >= target_date,
            Transaction.created_at < next_month,
            Transaction.status.ilike("Successful"),
        ).scalar() or 0
        revenue_trend.append(float(monthly_revenue))

    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_products": total_products,
        "pending_products": pending_products,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "total_revenue": revenue_total,
        "pending_reports": pending_reports,
        "users": total_students,
        "activeStudents": active_students,
        "products": total_products,
        "orders": total_orders,
        "completedOrders": completed_orders,
        "pendingProducts": pending_products,
        "pendingReports": pending_reports,
        "revenue": format_revenue(revenue_total),
        "trends": {
            "months": trend_months,
            "user_growth": user_growth,
            "product_uploads": product_uploads,
            "revenue": revenue_trend,
        },
        "salesTrend": product_uploads,
        "revenueTrend": revenue_trend,
        "registrations": user_growth,
        "orderStatus": status_distribution,
        "categories": categories,
        "college_activity": college_activity,
        "collegeActivity": college_activity,
        "productStatusBreakdown": product_status_breakdown,
        "recentActivity": recent_activity,
    }


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


@app.get("/api/admin/colleges")
def get_colleges():
    """Returns all colleges from the university structure."""
    return sorted(list(UNIVERSITY_STRUCTURE.keys()))


@app.get("/api/admin/departments")
def get_departments(college: Optional[str] = None):
    """
    Returns departments from the university structure.
    If college is provided, returns only that college's departments.
    Otherwise, returns all departments flattened.
    """
    if college and college in UNIVERSITY_STRUCTURE:
        return UNIVERSITY_STRUCTURE[college]
    
    all_departments = []
    for depts in UNIVERSITY_STRUCTURE.values():
        all_departments.extend(depts)
    return sorted(all_departments)


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


@app.delete("/api/admin/users/{id}")
def delete_user(id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        db.query(Product).filter(
            or_(
                Product.seller == student.student_id,
                Product.seller == student.name,
            )
        ).delete(synchronize_session=False)
        db.delete(student)
        db.commit()
        return {"message": "User deleted successfully"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete user and associated products.")


@app.get("/api/admin/verifications")
def get_admin_verifications(
    search: Optional[str] = None,
    college: Optional[str] = None,
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

    if college and college.strip().lower() != "all":
        query = query.filter(Student.college.ilike(college.strip()))

    if department and department.strip().lower() != "all":
        query = query.filter(Student.department.ilike(department.strip()))

    students = query.order_by(Student.id.desc()).all()
    results = []
    for student in students:
        status = "Rejected" if student.verification_reason else "Pending"
        id_card_path = os.path.join(ID_CARD_DIR, f"{student.student_id}.jpg")
        avatar_path = os.path.join(AVATAR_DIR, f"{student.student_id}.jpg")
        if os.path.exists(id_card_path):
            uploaded_id_card = f"http://127.0.0.1:8000/static/uploads/id_cards/{student.student_id}.jpg"
        elif os.path.exists(avatar_path):
            uploaded_id_card = f"http://127.0.0.1:8000/static/uploads/avatars/{student.student_id}.jpg"
        else:
            uploaded_id_card = None
        results.append({
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "email": student.email,
            "phone": student.phone,
            "college": student.college,
            "department": student.department or "General Studies",
            "status": status,
            "uploaded_id_card": uploaded_id_card,
            "reason": student.verification_reason,
            "is_verified": student.is_verified,
        })

    return results


@app.post("/api/student/upload-id")
async def upload_student_id(
    student_id: str = Form(...),
    id_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.student_id == student_id.strip()).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    content_type = (id_photo.content_type or "").lower()
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="ID photo must be a JPEG, PNG, or WebP image.")

    destination = os.path.join(ID_CARD_DIR, f"{student.student_id}.jpg")
    try:
        with open(destination, "wb") as output_file:
            shutil.copyfileobj(id_photo.file, output_file)
    except OSError:
        raise HTTPException(status_code=500, detail="Failed to save student ID photo.")
    finally:
        await id_photo.close()

    student.id_card_url = f"http://127.0.0.1:8000/static/uploads/id_cards/{student.student_id}.jpg"
    student.verification_reason = None
    db.commit()
    db.refresh(student)

    return {
        "message": "Student ID uploaded successfully.",
        "student_id": student.student_id,
        "id_card_url": student.id_card_url,
    }


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

    admin = db.query(Admin).order_by(Admin.id.asc()).first()

    try:
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

        db.commit()
        db.refresh(student)

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


@app.get("/api/admin/products")
def get_admin_products(
    status: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if status and status.strip().lower() != "all":
        query = query.filter(Product.status.ilike(status.strip()))

    if category and category.strip().lower() != "all":
        query = query.filter(Product.category.ilike(category.strip()))

    if subcategory and subcategory.strip().lower() != "all":
        query = query.filter(Product.subcategory.ilike(subcategory.strip()))

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
            "subcategory": p.subcategory,
            "condition": condition,
            "seller_verified": bool(student_record),
            "moderation_reason": p.moderation_reason,
        })

    return results


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
            if _notifications_enabled(db, "approvalNotifs"):
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
            "notification_created": bool(
                (seller_student or seller_id) and _notifications_enabled(db, "approvalNotifs")
            ),
        }
    except Exception:
        db.rollback()
        raise


@app.patch("/api/admin/products/{id}")
def update_product_status_patch(id: int, data: ProductStatusUpdate, db: Session = Depends(get_db)):
    return update_product_status_impl(id=id, data=data, db=db)


@app.put("/api/admin/products/{id}")
def update_product_status_put(id: int, data: ProductStatusUpdate, db: Session = Depends(get_db)):
    return update_product_status_impl(id=id, data=data, db=db)


@app.delete("/api/admin/products/{id}")
def delete_product_admin(id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}


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
            related_order = None
            if payment_type_value == "Product Purchase":
                related_order = (
                    db.query(Order)
                    .filter(Order.student_id == tx.student_id)
                    .order_by(Order.created_at.desc())
                    .first()
                )
            related_product = (
                db.query(Product).filter(Product.id == related_order.product_id).first()
                if related_order else None
            )
            payment_method = (
                "Chapa" if payment_type_value == "Wallet Deposit"
                else "Wallet" if payment_type_value == "Product Purchase"
                else "SantimPay" if payment_type_value == "Seller Payout"
                else "Wallet"
            )
            payment_source = f"{tx.type or ''} {tx.description or ''}".lower()
            seller_display = (
                "System (Chapa)"
                if payment_type_value == "Wallet Deposit" and "chapa" in payment_source
                else "Self"
                if payment_type_value == "Wallet Deposit"
                else related_product.seller if related_product and related_product.seller else "Unknown"
            )

            results.append({
                "id": tx.id,
                "transaction_id": tx.tx_id,
                "buyer_id": tx.student_id,
                "seller_id": seller_display,
                "order_id": related_order.id if related_order else tx.tx_id,
                "amount": float(tx.amount or 0),
                "payment_type": payment_type_value,
                "payment_method": payment_method,
                "status": payment_status,
                "date": tx.created_at.isoformat() if tx.created_at else None,
                "created_date": tx.created_at.isoformat() if tx.created_at else None,
                "completed_date": tx.created_at.isoformat() if payment_status == "Successful" and tx.created_at else None,
                "chapa_reference": tx.tx_id if payment_method == "Chapa" else None,
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
    raise HTTPException(
        status_code=403,
        detail="Payment status can only be changed by a verified gateway webhook or verification.",
    )


@app.get("/api/payment/verify/{tx_ref}")
def verify_payment_with_chapa(tx_ref: str, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.tx_id == tx_ref).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found.")

    secret = os.getenv("CHAPA_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Chapa verification is not configured.")

    previous_status = _normalize_payment_status(transaction.status)
    try:
        response = httpx.get(
            f"https://api.chapa.co/v1/transaction/verify/{tx_ref}",
            headers={"Authorization": f"Bearer {secret}"},
            timeout=15.0,
        )
        chapa_payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify payment with Chapa: {exc}")

    gateway_data = chapa_payload.get("data") if isinstance(chapa_payload, dict) else {}
    gateway_status = _normalize_payment_status(
        (gateway_data or {}).get("status") if isinstance(gateway_data, dict) else None
    )
    if response.is_error and gateway_status == "Pending":
        gateway_status = "Failed"

    transaction.status = gateway_status
    admin = db.query(Admin).filter(Admin.username == "mau9999").first() or db.query(Admin).order_by(Admin.id.asc()).first()
    if admin:
        db.add(AuditLog(
            admin_id=admin.id,
            action="Payment Verification Retried",
            entity_type="Payment",
            entity_id=transaction.id,
            description=f"Admin {admin.username} retried Chapa verification for {tx_ref}; status changed from {previous_status} to {gateway_status}.",
            status="SUCCESS",
            ip_address="127.0.0.1",
        ))

    db.commit()
    db.refresh(transaction)
    return {
        "success": not response.is_error,
        "transaction_id": transaction.tx_id,
        "status": gateway_status,
        "chapa_reference": transaction.tx_id,
    }


@app.post("/api/admin/payments/{payment_id}/verify")
async def verify_admin_payment_with_chapa(payment_id: int, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == payment_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found.")
    if _normalize_payment_type(transaction.type) != "Wallet Deposit":
        raise HTTPException(status_code=400, detail="Only wallet deposits can be verified through Chapa.")

    secret = os.getenv("CHAPA_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="Chapa verification is not configured.")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://api.chapa.co/v1/transaction/verify/{transaction.tx_id}",
                headers={"Authorization": f"Bearer {secret}"},
            )
            chapa_payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify payment with Chapa: {exc}")

    gateway_data = chapa_payload.get("data") if isinstance(chapa_payload, dict) else None
    gateway_status = str(
        gateway_data.get("status") if isinstance(gateway_data, dict)
        else chapa_payload.get("status", "") if isinstance(chapa_payload, dict)
        else ""
    ).lower()
    if response.is_error or gateway_status != "success":
        return {
            "success": False,
            "transaction_id": transaction.tx_id,
            "status": _normalize_payment_status(gateway_status),
            "chapa_reference": transaction.tx_id,
        }

    try:
        transaction = (
            db.query(Transaction)
            .filter(Transaction.id == payment_id)
            .with_for_update()
            .first()
        )
        if not transaction:
            raise HTTPException(status_code=404, detail="Payment transaction no longer exists.")
        student = (
            db.query(Student)
            .filter(Student.student_id == transaction.student_id)
            .with_for_update()
            .first()
        )
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        was_already_successful = _normalize_payment_status(transaction.status) == "Successful"
        if not was_already_successful:
            student.wallet_balance = Decimal(str(student.wallet_balance or 0)) + Decimal(str(transaction.amount))
            transaction.status = "Successful"

            admin = db.query(Admin).filter(Admin.username == "mau9999").first() or db.query(Admin).order_by(Admin.id.asc()).first()
            db.add(AuditLog(
                admin_id=admin.id if admin else None,
                action="Payment Verified",
                entity_type="Payment",
                entity_id=transaction.id,
                description=f"Admin {admin.username if admin else 'system'} verified Chapa payment {transaction.tx_id}; credited {transaction.amount} ETB to student {student.student_id}.",
                status="SUCCESS",
                ip_address="127.0.0.1",
            ))

        db.commit()
        db.refresh(transaction)
        db.refresh(student)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unable to settle payment safely: {exc}")

    return {
        "success": True,
        "transaction_id": transaction.tx_id,
        "status": transaction.status,
        "wallet_balance": float(student.wallet_balance or 0),
        "chapa_reference": transaction.tx_id,
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

    if _notifications_enabled(db, "paymentNotifs"):
        db.add(Notification(
            student_id=student.student_id,
            title="Payment Successful",
            message=f"Your Chapa wallet deposit of {amount} ETB was completed successfully.",
            type="payment",
            is_read=False,
        ))

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


# 17. የተማሪዎች ቅሬታ ማውጫ (GET /api/admin/reports)
@app.get("/api/admin/reports")
def get_admin_reports(db: Session = Depends(get_db)):
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "report_id": f"RPT-{r.id:04d}",
            "issue": r.issue,
            "category": r.category,
            "email": r.email,
            "student": r.student_name,
            "student_id": r.student_id,
            "status": r.status,
            "date": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else None,
        }
        for r in reports
    ]


# 18. የቅሬታ መፍቻ እና አውቶማቲክ ኖቲፊኬሽን መላኪያ (PUT & PATCH /api/admin/reports/{id})
def resolve_report_impl(id: int, data: ReportUpdate, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = data.status
    db.commit()
    db.refresh(report)

    if data.status.lower() in {"closed", "resolved"}:
        issue_snippet = (report.issue or "")[:30]
        if report.student_id:
            db_notification = Notification(
                student_id=report.student_id,
                title="Support Case Update",
                message=f"Your reported issue regarding '{issue_snippet}...' has been marked as {data.status} by Admin."
            )
            db.add(db_notification)
        db.commit()

    return {"message": "Dispute status updated successfully", "status": report.status}


@app.put("/api/admin/reports/{id}")
def resolve_report_put(id: int, data: ReportUpdate, db: Session = Depends(get_db)):
    return resolve_report_impl(id, data, db)


@app.patch("/api/admin/reports/{id}")
def resolve_report_patch(id: int, data: ReportUpdate, db: Session = Depends(get_db)):
    return resolve_report_impl(id, data, db)


# 19. የአስተዳዳሪ ማስታወቂያ ማሰራጫ (POST /api/admin/notifications/broadcast)
@app.post("/api/admin/notifications/broadcast")
def broadcast_notification(data: BroadcastNotificationRequest, db: Session = Depends(get_db)):
    if not data.title or not data.title.strip():
        raise HTTPException(status_code=400, detail="Broadcast title is required.")

    announcement_notifications_enabled = _setting_bool(
        _get_setting_value(
            db,
            "notifications",
            "announcementNotifs",
            DEFAULT_SETTINGS_BLOCKS["notifications"]["announcementNotifs"],
        ),
        DEFAULT_SETTINGS_BLOCKS["notifications"]["announcementNotifs"],
    )
    if not announcement_notifications_enabled:
        raise HTTPException(
            status_code=400,
            detail="Announcement notifications are globally disabled in System Settings",
        )

    target = (data.target or "Everyone").strip()
    normalized_target = target.lower()
    if normalized_target in {"all students", "all", "everyone"}:
        query = db.query(Student)
    elif normalized_target == "sellers":
        listed_sellers = db.query(Product.seller).filter(
            Product.seller.isnot(None),
            Product.status.in_(["Approved", "Sold", "Active"]),
        ).distinct()
        query = db.query(Student).filter(
            (Student.is_verified.is_(True)) |
            Student.student_id.in_(listed_sellers) |
            Student.name.in_(listed_sellers)
        )
    elif normalized_target == "buyers":
        placed_order_students = db.query(Order.student_id).filter(
            Order.student_id.isnot(None)
        ).distinct()
        query = db.query(Student).filter(
            (Student.status == "Active") | Student.student_id.in_(placed_order_students)
        )
    else:
        query = db.query(Student).filter(Student.department == target)

    students = query.all()
    for s in students:
        db.add(Notification(
            student_id=s.student_id,
            title=data.title.strip(),
            message=data.message,
            target=target,
            type=f"broadcast_{target}",
            is_read=False
        ))
    db.commit()
    return {
        "message": f"Broadcast delivered to {len(students)} students",
        "delivered_count": len(students),
        "target": target,
    }


@app.get("/api/admin/notifications/broadcasts")
def get_broadcast_history(db: Session = Depends(get_db)):
    broadcasts = (
        db.query(Notification)
        .filter(
            or_(
                Notification.type == "broadcast",
                Notification.type.startswith("broadcast_", autoescape=True),
            )
        )
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .all()
    )
    campaigns = {}
    for notification in broadcasts:
        notification_type = notification.type or ""
        decoded_target = (
            notification_type.replace("broadcast_", "", 1)
            if notification_type.startswith("broadcast_")
            else notification.target or ""
        )
        normalized_decoded_target = decoded_target.strip().lower()
        campaign_title = notification.title or "Untitled Broadcast"
        if normalized_decoded_target in {"", "broadcast"}:
            title_lower = campaign_title.lower()
            if "information technology" in title_lower or re.search(r"\bit\b", title_lower):
                campaign_target = "Department of Information Technology (IT)"
            elif "buyers" in title_lower:
                campaign_target = "Buyers"
            else:
                campaign_target = "Everyone"
        else:
            campaign_target = decoded_target.strip()
        campaign_key = (notification_type, campaign_title, notification.message)
        campaign = campaigns.setdefault(campaign_key, {
            "id": notification.id,
            "title": campaign_key[1],
            "message": notification.message,
            "delivered": 0,
            "read": 0,
            "unread": 0,
            "date": notification.created_at.isoformat() if notification.created_at else None,
            "target": campaign_target,
        })
        campaign["delivered"] += 1
        if notification.is_read:
            campaign["read"] += 1
        else:
            campaign["unread"] += 1

    return list(campaigns.values())


# 21. Create Main Category (POST /api/admin/categories)
@app.post("/api/admin/categories", status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    """Insert a new main category into the database"""
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
    parent_category = db.query(Category).filter(Category.id == data.category_id).first()
    if not parent_category:
        raise HTTPException(status_code=404, detail="Parent category not found")
    
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
