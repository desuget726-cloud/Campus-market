import os
import logging
from typing import Generator, Iterable, Optional
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


def missing_model_columns(table_names: Optional[Iterable[str]] = None) -> dict[str, list[str]]:
    """List model columns missing from the current database schema."""
    selected_tables = set(table_names) if table_names is not None else None
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing = {}

    for table in Base.metadata.sorted_tables:
        if selected_tables is not None and table.name not in selected_tables:
            continue
        if table.name not in existing_tables:
            missing[table.name] = [column.name for column in table.columns]
            continue
        existing_columns = {
            column["name"] for column in inspector.get_columns(table.name)
        }
        absent_columns = [
            column.name for column in table.columns
            if column.name not in existing_columns
        ]
        if absent_columns:
            missing[table.name] = absent_columns

    return missing


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
    if "admin_sessions" in inspector.get_table_names():
        _add_column_if_missing("admin_sessions", "revoked_at", "DATETIME NULL")
        _add_column_if_missing("admin_sessions", "revoke_reason", "VARCHAR(60) NULL")
    if "audit_logs" in inspector.get_table_names():
        audit_log_additions = {
            "user_agent": "VARCHAR(255) NULL",
            "actor_role": "VARCHAR(30) NULL",
            "event_type": "VARCHAR(255) NULL",
            "category": "VARCHAR(30) NULL",
            "metadata_json": "JSON NULL",
        }
        for column_name, column_definition in audit_log_additions.items():
            _add_column_if_missing("audit_logs", column_name, column_definition)
    if "reviews" in inspector.get_table_names():
        review_columns = {
            column["name"] for column in inspect(engine).get_columns("reviews")
        }
        if "is_hidden" not in review_columns:
            with engine.begin() as connection:
                connection.execute(text(
                    "ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE"
                ))
    if "support_tickets" in inspector.get_table_names():
        support_ticket_columns = {
            column["name"] for column in inspect(engine).get_columns("support_tickets")
        }
        support_ticket_additions = {
            "user_id": "VARCHAR(50) NULL",
            "requester_name": "VARCHAR(150) NULL",
            "requester_email": "VARCHAR(150) NULL",
            "subject": "VARCHAR(200) NULL",
            "category": "VARCHAR(50) NOT NULL DEFAULT 'General'",
            "message": "TEXT NULL",
            "attachment_url": "VARCHAR(500) NULL",
            "status": "VARCHAR(30) NOT NULL DEFAULT 'Open'",
            "assigned_admin_id": "INTEGER NULL",
            "last_admin_reply_at": "DATETIME NULL",
            "last_reminder_at": "DATETIME NULL",
            "reopen_used": "BOOLEAN NOT NULL DEFAULT FALSE",
            "reopened_at": "DATETIME NULL",
            "revision": "INTEGER NOT NULL DEFAULT 1",
            "created_at": "DATETIME NULL",
            "updated_at": "DATETIME NULL",
        }
        for column_name, column_definition in support_ticket_additions.items():
            if column_name not in support_ticket_columns:
                _add_column_if_missing("support_tickets", column_name, column_definition)
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE support_tickets SET status = CASE LOWER(status) "
                "WHEN 'open' THEN 'Open' "
                "WHEN 'in_progress' THEN 'In Progress' "
                "WHEN 'waiting for user' THEN 'Waiting for User' "
                "WHEN 'resolved' THEN 'Resolved' "
                "WHEN 'closed' THEN 'Closed' "
                "ELSE status END"
            ))
            connection.execute(text(
                "UPDATE support_tickets SET created_at = CURRENT_TIMESTAMP "
                "WHERE created_at IS NULL"
            ))
            connection.execute(text(
                "UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP "
                "WHERE updated_at IS NULL"
            ))
    if "notifications" in inspector.get_table_names():
        notification_indexes = {
            index["name"]: index for index in inspect(engine).get_indexes("notifications")
        }
        legacy_unique_index = notification_indexes.get("uq_notifications_user_type_reference")
        if legacy_unique_index and legacy_unique_index.get("unique"):
            if engine.dialect.name == "mysql":
                statement = "ALTER TABLE notifications DROP INDEX uq_notifications_user_type_reference"
            else:
                statement = "DROP INDEX uq_notifications_user_type_reference"
            with engine.begin() as connection:
                connection.execute(text(statement))
        changed_moderation_links = 0
        with engine.begin() as connection:
            legacy_notices = connection.execute(text(
                "SELECT id, title, reference_id FROM notifications "
                "WHERE type = :notification_type AND action_url = :legacy_url"
            ), {
                "notification_type": "moderation_action",
                "legacy_url": "/dashboard",
            }).mappings().all()
            for notice in legacy_notices:
                report_id = str(notice["reference_id"] or "").strip()
                if not report_id.isdigit() or int(report_id) < 1:
                    continue
                section = (
                    "warnings"
                    if notice["title"] in {"Marketplace warning", "Product hidden"}
                    else "account-notices"
                    if notice["title"] in {"Account suspended", "Account deactivated"}
                    else None
                )
                if section is None:
                    continue
                connection.execute(text(
                    "UPDATE notifications SET action_url = :action_url "
                    "WHERE id = :notification_id AND action_url = :legacy_url"
                ), {
                    "action_url": (
                        f"/dashboard?tab=seller&section={section}&item=report-{int(report_id)}"
                    ),
                    "notification_id": notice["id"],
                    "legacy_url": "/dashboard",
                })
                changed_moderation_links += 1
        logging.getLogger("app.startup").info(
            "Moderation notification link migration updated %d rows.",
            changed_moderation_links,
        )
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
    if "reports" in inspector.get_table_names():
        report_additions = {
            "product_id": "INTEGER NULL",
            "order_id": "INT NULL",
            "student_id": "VARCHAR(50) NULL",
            "seller_id": "VARCHAR(50) NULL",
            "student_name": "VARCHAR(150) NOT NULL DEFAULT ''",
            "email": "VARCHAR(100) NULL",
            "category": "VARCHAR(100) NULL",
            "issue": "VARCHAR(1000) NOT NULL DEFAULT ''",
            "evidence_image": "TEXT NULL",
            "priority": "VARCHAR(20) NOT NULL DEFAULT 'Low'",
            "status": "VARCHAR(50) NOT NULL DEFAULT 'Open'",
            "created_at": "DATETIME NULL",
            "reviewed_by": "INT NULL",
            "reviewed_at": "DATETIME NULL",
            "decision": "VARCHAR(50) NULL",
            "decision_reason": "TEXT NULL",
            "review_by": "DATE NULL",
            "resolved_by": "INT NULL",
            "resolved_at": "DATETIME NULL",
            "refunded_amount": "DECIMAL(10,2) NOT NULL DEFAULT 0.00",
            "seller_response": "TEXT NULL",
            "seller_response_image": "TEXT NULL",
            "seller_response_at": "DATETIME NULL",
            "appeal_text": "TEXT NULL",
            "appealed_by": "VARCHAR(50) NULL",
            "appealed_at": "DATETIME NULL",
            "revision": "INTEGER NOT NULL DEFAULT 1",
        }
        for column_name, definition in report_additions.items():
            _add_column_if_missing("reports", column_name, definition)
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE reports SET created_at = CURRENT_TIMESTAMP "
                "WHERE created_at IS NULL"
            ))
    if "payment_idempotency" in inspector.get_table_names():
        idempotency_columns = {column["name"] for column in inspector.get_columns("payment_idempotency")}
        if "product_id" not in idempotency_columns:
            _add_column_if_missing(
                "payment_idempotency", "product_id", "INT NULL"
            )
        if engine.dialect.name == "mysql":
            order_id = next(
                column for column in inspector.get_columns("payment_idempotency")
                if column["name"] == "order_id"
            )
            if not order_id["nullable"]:
                with engine.begin() as connection:
                    connection.execute(text(
                        "ALTER TABLE payment_idempotency MODIFY COLUMN order_id INT NULL"
                    ))
    if "seller_payment_accounts" in inspector.get_table_names():
        payout_columns = {
            column["name"] for column in inspector.get_columns("seller_payment_accounts")
        }
        payout_additions = {
            "encrypted_account_number": "VARCHAR(255) NULL",
            "account_last4": "VARCHAR(4) NULL",
            "created_at": "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
        }
        for column_name, definition in payout_additions.items():
            if column_name not in payout_columns:
                _add_column_if_missing(
                    "seller_payment_accounts", column_name, definition
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
            "pickup_location": "VARCHAR(255) NOT NULL DEFAULT ''",
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

    inspector = inspect(engine)
    inspector.clear_cache()
    missing_workflow_columns = missing_model_columns({"reports", "support_tickets"})
    if missing_workflow_columns:
        missing_description = "; ".join(
            f"{table}: {', '.join(columns)}"
            for table, columns in missing_workflow_columns.items()
        )
        raise RuntimeError(
            f"Database schema is missing report/support model columns: {missing_description}"
        )
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
