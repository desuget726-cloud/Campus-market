import os
import logging
from typing import Generator
from urllib.parse import quote_plus

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
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


def _add_column_if_missing(table_name: str, column_name: str, column_definition: str) -> None:
    inspector = inspect(engine)
    if column_name in {
        column["name"] for column in inspector.get_columns(table_name)
    }:
        return

    try:
        with engine.begin() as connection:
            connection.execute(text(
                f"ALTER TABLE `{table_name}` ADD COLUMN `{column_name}` {column_definition}"
            ))
    except SQLAlchemyError:
        inspector = inspect(engine)
        if column_name not in {
            column["name"] for column in inspector.get_columns(table_name)
        }:
            raise


def init_db() -> None:
    """Create database tables for all models inheriting from `Base`.

    Call this from an application startup event or a separate setup script.
    """
    tables = Base.metadata.sorted_tables
    if engine.dialect.name == "mysql" and "students" in inspect(engine).get_table_names():
        with engine.connect() as connection:
            student_id_charset, student_id_collation = connection.execute(text(
                "SELECT CHARACTER_SET_NAME, COLLATION_NAME "
                "FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() "
                "AND TABLE_NAME = 'students' AND COLUMN_NAME = 'student_id'"
            )).one()
        for table in tables:
            if any(foreign_key.target_fullname == "students.student_id" for foreign_key in table.foreign_keys):
                table.dialect_options["mysql"]["charset"] = student_id_charset
                table.dialect_options["mysql"]["collate"] = student_id_collation
    Base.metadata.create_all(bind=engine, tables=tables)
    inspector = inspect(engine)
    if "admin_login_history" in inspect(engine).get_table_names():
        login_history_columns = {
            column["name"] for column in inspect(engine).get_columns("admin_login_history")
        }
        missing_login_history_columns = {
            "admin_session_id": "INTEGER NULL",
            "is_deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
            "deleted_at": "DATETIME NULL",
        }
        for column_name, column_definition in missing_login_history_columns.items():
            if column_name not in login_history_columns:
                _add_column_if_missing(
                    "admin_login_history", column_name, column_definition
                )
    if "wallets" in inspector.get_table_names():
        wallet_columns = {column["name"] for column in inspector.get_columns("wallets")}
        if "frozen_balance" not in wallet_columns:
            _add_column_if_missing(
                "wallets",
                "frozen_balance",
                "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            )
        if engine.dialect.name == "mysql":
            wallet_checks = {
                constraint["name"]
                for constraint in inspect(engine).get_check_constraints("wallets")
            }
            with engine.connect() as connection:
                has_negative_balance = connection.execute(
                    text("SELECT 1 FROM wallets WHERE balance < 0 LIMIT 1")
                ).first()
            if "ck_wallets_nonnegative_balance" not in wallet_checks and not has_negative_balance:
                with engine.begin() as connection:
                    connection.execute(text(
                        "ALTER TABLE wallets ADD CONSTRAINT ck_wallets_nonnegative_balance CHECK (balance >= 0)"
                    ))
    if "disputes" in inspector.get_table_names():
        dispute_columns = {column["name"] for column in inspector.get_columns("disputes")}
        if "post_payment" not in dispute_columns:
            _add_column_if_missing(
                "disputes", "post_payment", "BOOLEAN NOT NULL DEFAULT FALSE"
            )
        if "frozen_amount" not in dispute_columns:
            _add_column_if_missing(
                "disputes",
                "frozen_amount",
                "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            )
    if "payment_idempotency" in inspector.get_table_names():
        idempotency_columns = {column["name"] for column in inspector.get_columns("payment_idempotency")}
        if "product_id" not in idempotency_columns:
            _add_column_if_missing(
                "payment_idempotency", "product_id", "INT NULL"
            )
    inspector = inspect(engine)
    if "reviews" in inspector.get_table_names():
        review_constraints = {
            constraint["name"]
            for constraint in inspector.get_unique_constraints("reviews")
        }
        review_indexes = {
            index["name"]
            for index in inspector.get_indexes("reviews")
            if index.get("unique")
        }
        if (
            "uq_reviews_order_student" not in review_constraints
            and "uq_reviews_order_student" not in review_indexes
        ):
            with engine.begin() as connection:
                connection.execute(text(
                    "CREATE UNIQUE INDEX uq_reviews_order_student "
                    "ON reviews (order_id, student_id)"
                ))
    if "notifications" in inspector.get_table_names():
        notification_columns = {
            column["name"] for column in inspector.get_columns("notifications")
        }
        missing_notification_columns = {
            "reference_id": "VARCHAR(75) NULL",
            "action_label": "VARCHAR(150) NULL",
            "action_url": "VARCHAR(500) NULL",
        }
        for column_name, column_definition in missing_notification_columns.items():
            if column_name not in notification_columns:
                _add_column_if_missing(
                    "notifications", column_name, column_definition
                )
        notification_indexes = {
            index["name"] for index in inspect(engine).get_indexes("notifications")
        }
        if "uq_notifications_user_type_reference" not in notification_indexes:
            with engine.begin() as connection:
                connection.execute(text(
                    "CREATE UNIQUE INDEX uq_notifications_user_type_reference "
                    "ON notifications (student_id, type, reference_id)"
                ))
    if "products" in inspector.get_table_names() and "condition" not in {
        column["name"] for column in inspector.get_columns("products")
    }:
        _add_column_if_missing("products", "condition", "VARCHAR(50) NULL")
    if "products" in inspector.get_table_names() and "views" not in {
        column["name"] for column in inspector.get_columns("products")
    }:
        _add_column_if_missing(
            "products", "views", "INT NOT NULL DEFAULT 0"
        )
    if "products" in inspector.get_table_names():
        product_columns = {column["name"] for column in inspector.get_columns("products")}
        missing_product_columns = {
            "negotiable": "BOOLEAN NOT NULL DEFAULT FALSE",
            "pickup_location": "VARCHAR(255) NOT NULL DEFAULT 'Student Center'",
            "pickup_hours": "VARCHAR(120) NOT NULL DEFAULT '08:00-17:00'",
            "image_notes": "TEXT NULL",
            "seller_id": "VARCHAR(50) NULL",
        }
        for column_name, column_definition in missing_product_columns.items():
            if column_name not in product_columns:
                _add_column_if_missing(
                    "products", column_name, column_definition
                )
        if "seller_id" not in product_columns:
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE products SET seller_id = seller "
                    "WHERE seller IS NOT NULL AND EXISTS "
                    "(SELECT 1 FROM students WHERE students.student_id = products.seller)"
                ))
    if "students" in inspector.get_table_names():
        student_columns = {column["name"] for column in inspector.get_columns("students")}
        missing_student_columns = {
            "pay_failed_attempts": "INT NOT NULL DEFAULT 0",
            "pay_locked_until": "DATETIME NULL",
        }
        for column_name, column_definition in missing_student_columns.items():
            if column_name not in student_columns:
                _add_column_if_missing(
                    "students", column_name, column_definition
                )
    if "product_views" in inspector.get_table_names():
        product_view_columns = {column["name"] for column in inspector.get_columns("product_views")}
        missing_product_view_columns = {
            "viewer_id": "VARCHAR(50) NULL",
            "viewed_at": "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }
        for column_name, column_definition in missing_product_view_columns.items():
            if column_name not in product_view_columns:
                _add_column_if_missing(
                    "product_views", column_name, column_definition
                )
    if "reports" in inspector.get_table_names():
        report_columns = {column["name"] for column in inspector.get_columns("reports")}
        missing_columns = {
            "seller_id": "VARCHAR(50) NULL",
            "evidence_image": "VARCHAR(255) NULL",
        }
        for column_name, column_definition in missing_columns.items():
            if column_name not in report_columns:
                _add_column_if_missing("reports", column_name, column_definition)
    if "orders" in inspector.get_table_names():
        order_columns = {column["name"] for column in inspector.get_columns("orders")}
        missing_order_columns = {
            "is_funds_released": "BOOLEAN NOT NULL DEFAULT FALSE",
            "hidden_by_buyer": "BOOLEAN NOT NULL DEFAULT FALSE",
            "dispute_reason": "TEXT NULL",
            "platform_fee": "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            "seller_commission": "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            "paid_at": "DATETIME NULL",
            "completed_at": "DATETIME NULL",
            "expired_at": "DATETIME NULL",
            "refund_status": "VARCHAR(20) NOT NULL DEFAULT 'none'",
            "refund_reference": "VARCHAR(100) NULL",
            "refund_attempts": "INT NOT NULL DEFAULT 0",
            "rejection_reason": "VARCHAR(30) NULL",
            "rejection_note": "TEXT NULL",
        }
        for column_name, column_definition in missing_order_columns.items():
            if column_name not in order_columns:
                _add_column_if_missing(
                    "orders", column_name, column_definition
                )
        order_indexes = {
            index["name"] for index in inspect(engine).get_indexes("orders")
        }
        seller_orders_index = "ix_orders_seller_status_completed_at"
        if seller_orders_index not in order_indexes:
            with engine.begin() as connection:
                connection.execute(text(
                    f"CREATE INDEX {seller_orders_index} "
                    "ON orders (seller_id, status, completed_at)"
                ))
    if "students" in inspector.get_table_names():
        student_columns = {column["name"] for column in inspector.get_columns("students")}
        missing_student_columns = {
            "has_password": "BOOLEAN NOT NULL DEFAULT TRUE",
            "two_factor_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "notif_msg_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_msg_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_order_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_order_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_pay_inapp": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_pay_email": "BOOLEAN NOT NULL DEFAULT TRUE",
            "notif_browser_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "preferred_pickup_location": "VARCHAR(255) NOT NULL DEFAULT 'Student Center'",
            "suspended_until": "DATETIME NULL",
            "pay_failed_attempts": "INT NOT NULL DEFAULT 0",
            "pay_locked_until": "DATETIME NULL",
        }
        for column_name, column_definition in missing_student_columns.items():
            if column_name not in student_columns:
                _add_column_if_missing(
                    "students", column_name, column_definition
                )
        if "has_password" not in student_columns:
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE students SET has_password = FALSE WHERE UPPER(student_id) LIKE 'OAUTH-%'"
                ))
        # Update existing records to set default values for notifications
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE students SET notif_pay_inapp = 1 "
                "WHERE notif_pay_inapp IS NULL OR notif_pay_inapp = 0"
            ))
        if engine.dialect.name == "mysql":
            for column_name in ("college", "department"):
                column = next(
                    column for column in inspect(engine).get_columns("students")
                    if column["name"] == column_name
                )
                if not column["nullable"]:
                    with engine.begin() as connection:
                        connection.execute(text(
                            f"ALTER TABLE students MODIFY COLUMN `{column_name}` VARCHAR(150) NULL"
                        ))
    _log_model_schema_drift()


def _log_model_schema_drift() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing_schema_items = []
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            missing_schema_items.append(f"{table.name} (table)")
            continue
        existing_columns = {
            column["name"] for column in inspector.get_columns(table.name)
        }
        missing_columns = sorted(
            column.name for column in table.columns
            if column.name not in existing_columns
        )
        missing_schema_items.extend(
            f"{table.name}.{column_name}" for column_name in missing_columns
        )
    if missing_schema_items:
        logging.getLogger("app.startup").error(
            "Database schema is missing model tables or columns after startup migrations: %s",
            ", ".join(missing_schema_items),
        )
