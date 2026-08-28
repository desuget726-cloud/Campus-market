# C:\xampp\htdocs\Backend\app\models.py
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    student_id = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    password = Column(String(255), nullable=False)
    college = Column(String(150), nullable=False)
    department = Column(String(150), nullable=False)
    wallet_balance = Column(Numeric(10, 2), default=200.00)
    status = Column(String(50), default="Active", nullable=False)
    restriction_reason = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_reason = Column(Text, nullable=True)
    id_card_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 1. ሬላሽንሺፖቹ በምን አምድ በኩል መገናኘት እንዳለባቸው በ "primaryjoin" በግልጽ አስቀምጠነዋል
    reports = relationship("Report", primaryjoin="Student.student_id == Report.student_id", back_populates="student")
    notifications = relationship("Notification", primaryjoin="Student.student_id == Notification.student_id", back_populates="student", cascade="all, delete-orphan")
    messages_sent = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", cascade="all, delete-orphan")
    messages_received = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver", cascade="all, delete-orphan")
    wishlist_items = relationship("WishlistItem", primaryjoin="Student.student_id == WishlistItem.student_id", back_populates="student", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", primaryjoin="Student.student_id == CartItem.student_id", back_populates="student", cascade="all, delete-orphan")
    orders = relationship("Order", primaryjoin="Student.student_id == Order.student_id", back_populates="student", cascade="all, delete-orphan")
    transactions = relationship("Transaction", primaryjoin="Student.student_id == Transaction.student_id", back_populates="student", cascade="all, delete-orphan")
    reviews = relationship("Review", primaryjoin="Student.student_id == Review.student_id", back_populates="student", cascade="all, delete-orphan")
    ai_recommendation_logs = relationship("AIRecommendationLog", back_populates="student", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    icon = Column(String(50), nullable=True)
    ads_count = Column(String(50), default="0 ads")
    subcategories = relationship("SubCategory", back_populates="category", cascade="all, delete-orphan")

class SubCategory(Base):
    __tablename__ = "subcategories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    icon = Column(String(50), nullable=True)
    ads_count = Column(String(50), default="0 ads")
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"))
    category = relationship("Category", back_populates="subcategories")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    subcategory = Column(String(100), nullable=True)
    price = Column(String(50), nullable=False)
    condition = Column(String(50), nullable=True)
    image = Column(String(255), nullable=True)
    description = Column(String(500), nullable=True)
    seller = Column(String(100), nullable=True)
    status = Column(String(50), default="Pending", nullable=False)
    moderation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    wishlist_items = relationship("WishlistItem", back_populates="product", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="product", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="product", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="product", cascade="all, delete-orphan")
    ai_recommendation_logs = relationship("AIRecommendationLog", back_populates="product", cascade="all, delete-orphan")

class AIRecommendationLog(Base):
    __tablename__ = "ai_recommendation_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(20), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)

    student = relationship("Student", back_populates="ai_recommendation_logs")
    product = relationship("Product", back_populates="ai_recommendation_logs")

class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="WishlistItem.student_id == Student.student_id", back_populates="wishlist_items")
    product = relationship("Product", back_populates="wishlist_items")

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="CartItem.student_id == Student.student_id", back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    price = Column(String(50), nullable=False)
    status = Column(String(50), default="Processing", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="Order.student_id == Student.student_id", back_populates="orders")
    product = relationship("Product", back_populates="orders")
    reviews = relationship("Review", back_populates="order", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    tx_id = Column(String(50), unique=True, nullable=False)
    type = Column(String(50), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String(255), nullable=True)
    status = Column(String(50), default="Successful", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="Transaction.student_id == Student.student_id", back_populates="transactions")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String(500), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    order = relationship("Order", back_populates="reviews")
    student = relationship("Student", primaryjoin="Review.student_id == Student.student_id", back_populates="reviews")

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=True)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="Admin", nullable=False)
    status = Column(String(50), default="Active", nullable=False)
    two_factor_enabled = Column(Boolean, default=True, nullable=False)
    two_factor_secret = Column(String(64), nullable=True)
    backup_codes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_login = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)

    audit_logs = relationship("AuditLog", back_populates="admin", cascade="all, delete-orphan")
    sessions = relationship("AdminSession", back_populates="admin", cascade="all, delete-orphan")
    login_history = relationship("AdminLoginHistory", back_populates="admin", cascade="all, delete-orphan")


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(500), unique=True, nullable=False, index=True)
    ip_address = Column(String(50), nullable=True)
    device_browser = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_active = Column(DateTime, server_default=func.now(), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    admin = relationship("Admin", back_populates="sessions")


class AdminLoginHistory(Base):
    __tablename__ = "admin_login_history"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(50), nullable=False)
    ip_address = Column(String(50), nullable=True)
    device_browser = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    admin = relationship("Admin", back_populates="login_history")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    identifier = Column(String(150), primary_key=True)
    failed_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(255), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, default="System")
    entity_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="SUCCESS", nullable=False)
    severity = Column(String(20), default="informational", nullable=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    admin = relationship("Admin", back_populates="audit_logs")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=True)
    seller_id = Column(String(50), nullable=True, index=True)
    student_name = Column(String(150), nullable=False)
    email = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    issue = Column(String(1000), nullable=False)
    evidence_image = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="Open")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="Report.student_id == Student.student_id", back_populates="reports")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=True)
    message = Column(String(500), nullable=False)
    target = Column(String(150), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    type = Column(String(50), nullable=False, default="system")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student", primaryjoin="Notification.student_id == Student.student_id", back_populates="notifications")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    message_text = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(20), nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    sender = relationship("Student", foreign_keys=[sender_id], back_populates="messages_sent")
    receiver = relationship("Student", foreign_keys=[receiver_id], back_populates="messages_received")
    product = relationship("Product", back_populates="messages")


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)