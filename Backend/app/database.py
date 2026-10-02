import os
from typing import Generator
from urllib.parse import quote_plus

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker, declarative_base, Session

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
if not DATABASE_URL:
    db_user = os.getenv("MYSQLUSER") or os.getenv("DB_USER")
    db_password = os.getenv("MYSQLPASSWORD") or os.getenv("DB_PASSWORD")
    db_host = os.getenv("MYSQLHOST") or os.getenv("DB_HOST")
    db_port = os.getenv("MYSQLPORT") or os.getenv("DB_PORT")
    db_name = os.getenv("MYSQLDATABASE") or os.getenv("DB_NAME")
    missing_variables = [
        name for name, value in {
            "MYSQLUSER/DB_USER": db_user,
            "MYSQLPASSWORD/DB_PASSWORD": db_password,
            "MYSQLHOST/DB_HOST": db_host,
            "MYSQLPORT/DB_PORT": db_port,
            "MYSQLDATABASE/DB_NAME": db_name,
        }.items() if not value
    ]
    if missing_variables:
        raise RuntimeError(
            "Database configuration is missing. Set DATABASE_URL or Railway MySQL variables: "
            + ", ".join(missing_variables)
        )
    DATABASE_URL = (
        f"mysql+pymysql://{quote_plus(db_user)}:{quote_plus(db_password)}"
        f"@{db_host}:{db_port}/{db_name}"
    )


# Create SQLAlchemy engine and session factory
if DATABASE_URL.startswith("sqlite"):
    sqlite_options = {"connect_args": {"check_same_thread": False}}
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        sqlite_options["poolclass"] = StaticPool
    engine = create_engine(DATABASE_URL, **sqlite_options)
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a SQLAlchemy DB session.

    Configure DB connection via the `DATABASE_URL` env var, or set
    `DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME` environment variables.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables for all models inheriting from `Base`.

    Call this from an application startup event or a separate setup script.
    """
    dispute_table = Base.metadata.tables.get("disputes")
    tables = [table for table in Base.metadata.sorted_tables if table is not dispute_table]
    Base.metadata.create_all(bind=engine, tables=tables)
    if dispute_table is not None:
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS disputes (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    order_id INT NOT NULL,
                    buyer_id VARCHAR(50) NOT NULL,
                    seller_id VARCHAR(50) NOT NULL,
                    reason VARCHAR(120) NOT NULL,
                    description TEXT NOT NULL,
                    evidence_image VARCHAR(500) NULL,
                    seller_response TEXT NULL,
                    seller_evidence VARCHAR(500) NULL,
                    previous_order_status VARCHAR(50) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
                    resolution VARCHAR(30) NULL,
                    resolved_by INT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    resolved_at DATETIME NULL,
                    INDEX ix_disputes_order_status (order_id, status),
                    INDEX ix_disputes_status_created (status, created_at),
                    INDEX ix_disputes_buyer_id (buyer_id),
                    INDEX ix_disputes_seller_id (seller_id)
                )
            """))
    inspector = inspect(engine)
    if "reviews" in inspector.get_table_names():
        review_constraints = {
            constraint["name"]
            for constraint in inspector.get_unique_constraints("reviews")
        }
        if "uq_reviews_order_student" not in review_constraints:
            with engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE reviews ADD CONSTRAINT uq_reviews_order_student "
                    "UNIQUE (order_id, student_id)"
                ))
    if "products" in inspector.get_table_names() and "condition" not in {
        column["name"] for column in inspector.get_columns("products")
    }:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE products ADD COLUMN `condition` VARCHAR(50) NULL"))
    if "products" in inspector.get_table_names() and "views" not in {
        column["name"] for column in inspector.get_columns("products")
    }:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE products ADD COLUMN views INT NOT NULL DEFAULT 0"))
    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        missing_product_columns = {
            "negotiable": "BOOLEAN NOT NULL DEFAULT FALSE",
            "pickup_location": "VARCHAR(255) NOT NULL DEFAULT 'Student Center'",
            "pickup_hours": "VARCHAR(120) NOT NULL DEFAULT '08:00-17:00'",
            "image_notes": "TEXT NULL",
        }
        for column_name, column_definition in missing_product_columns.items():
            if column_name not in product_columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE products ADD COLUMN `{column_name}` {column_definition}"))
    if "product_views" in inspector.get_table_names():
        product_view_columns = {column["name"] for column in inspector.get_columns("product_views")}
        missing_product_view_columns = {
            "viewer_id": "VARCHAR(50) NULL",
            "viewed_at": "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }
        for column_name, column_definition in missing_product_view_columns.items():
            if column_name not in product_view_columns:
                with engine.begin() as connection:
                    connection.execute(text(
                        f"ALTER TABLE product_views ADD COLUMN `{column_name}` {column_definition}"
                    ))
    if "reports" in inspector.get_table_names():
        report_columns = {column["name"] for column in inspector.get_columns("reports")}
        missing_columns = {
            "seller_id": "VARCHAR(50) NULL",
            "evidence_image": "VARCHAR(255) NULL",
        }
        for column_name, column_definition in missing_columns.items():
            if column_name not in report_columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE reports ADD COLUMN `{column_name}` {column_definition}"))
    if "orders" in inspector.get_table_names():
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        missing_order_columns = {
            "pickup_code": "INT NOT NULL DEFAULT 1000",
            "buyer_confirmed": "BOOLEAN NOT NULL DEFAULT FALSE",
            "seller_confirmed": "BOOLEAN NOT NULL DEFAULT FALSE",
            "is_funds_released": "BOOLEAN NOT NULL DEFAULT FALSE",
            "hidden_by_buyer": "BOOLEAN NOT NULL DEFAULT FALSE",
            "dispute_reason": "TEXT NULL",
            "platform_fee": "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            "seller_commission": "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            "paid_at": "DATETIME NULL",
            "seller_accept_deadline": "DATETIME NULL",
            "expired_at": "DATETIME NULL",
            "refund_status": "VARCHAR(20) NOT NULL DEFAULT 'none'",
            "refund_reference": "VARCHAR(100) NULL",
            "refund_attempts": "INT NOT NULL DEFAULT 0",
            "seller_reminder_12h_sent": "BOOLEAN NOT NULL DEFAULT FALSE",
            "seller_reminder_22h_sent": "BOOLEAN NOT NULL DEFAULT FALSE",
            "rejection_reason": "VARCHAR(30) NULL",
            "rejection_note": "TEXT NULL",
        }
        for column_name, column_definition in missing_order_columns.items():
            if column_name not in order_columns:
                with engine.begin() as connection:
                    connection.execute(text(
                        f"ALTER TABLE orders ADD COLUMN `{column_name}` {column_definition}"
                    ))
        deadline_expression = (
            "DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 48 HOUR)"
            if engine.dialect.name == "mysql"
            else "DATETIME(COALESCE(paid_at, created_at), '+48 hours')"
        )
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE orders SET paid_at = COALESCE(paid_at, created_at), "
                f"seller_accept_deadline = {deadline_expression} "
                "WHERE LOWER(status) = 'pending' AND LOWER(payment_status) = 'successful'"
            ))
        order_indexes = {index["name"] for index in inspect(engine).get_indexes("orders")}
        if "ix_orders_status_seller_accept_deadline" not in order_indexes:
            with engine.begin() as connection:
                connection.execute(text(
                    "CREATE INDEX ix_orders_status_seller_accept_deadline "
                    "ON orders (status, seller_accept_deadline)"
                ))
    if "students" in inspector.get_table_names():
        student_columns = {column["name"] for column in inspector.get_columns("students")}
        missing_student_columns = {
            "two_factor_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "notif_msg_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_msg_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_order_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_order_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_pay_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_pay_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_browser_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "preferred_pickup_location": "VARCHAR(255) NOT NULL DEFAULT 'Student Center'",
            "missed_acceptance_count": "INT NOT NULL DEFAULT 0",
            "suspended_until": "DATETIME NULL",
        }
        for column_name, column_definition in missing_student_columns.items():
            if column_name not in student_columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE students ADD COLUMN `{column_name}` {column_definition}"))
        # Update existing records to set default values for notifications
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE students SET notif_pay_inapp = 1 "
                "WHERE notif_pay_inapp IS NULL OR notif_pay_inapp = 0"
            ))
