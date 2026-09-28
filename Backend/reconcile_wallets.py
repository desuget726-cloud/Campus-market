"""Audit wallet balances against successful wallet ledger entries.

Run from Backend with the application database environment configured.
The default mode is read-only; pass --apply to write back wallet_id values
and reconciled balances.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models import Student, Transaction, Wallet
from app.wallet_service import CREDIT_TRANSACTION_TYPES, DEBIT_TRANSACTION_TYPES


def money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconcile wallet balances with the transaction ledger.")
    parser.add_argument("--apply", action="store_true", help="Backfill wallet_id and update mismatched balances.")
    args = parser.parse_args()
    db = SessionLocal()
    mismatches = []
    try:
        for wallet in db.query(Wallet).order_by(Wallet.student_id).all():
            rows = db.query(Transaction).filter(
                Transaction.student_id == wallet.student_id,
                Transaction.status.in_(["Successful", "Held", "Pending", "Processing"]),
            ).order_by(Transaction.created_at, Transaction.id).all()
            expected = Decimal("0.00")
            involved = []
            for row in rows:
                amount = abs(money(row.amount))
                status = str(row.status or "").lower()
                is_settled = status in {"successful", "held"}
                is_reserved_withdrawal = (
                    row.type == "Wallet Withdrawal"
                    and status in {"pending", "processing"}
                )
                if row.type in CREDIT_TRANSACTION_TYPES and status == "successful":
                    expected += amount
                elif row.type in DEBIT_TRANSACTION_TYPES and (is_settled or is_reserved_withdrawal):
                    expected -= amount
                else:
                    continue
                involved.append(f"{row.id}:{row.tx_id}:{row.type}:{amount:.2f}:{row.wallet_id or 'NULL'}")
                if args.apply and money(row.amount) < 0:
                    row.amount = amount
                if args.apply and row.wallet_id != wallet.id:
                    row.wallet_id = wallet.id

            expected = expected.quantize(Decimal("0.01"))
            current = money(wallet.balance)
            difference = (current - expected).quantize(Decimal("0.01"))
            if difference != 0:
                mismatches.append((wallet.student_id, current, expected, difference, involved))
                if args.apply:
                    wallet.balance = expected
                    wallet.updated_at = __import__("datetime").datetime.utcnow()
                    student = db.query(Student).filter(Student.student_id == wallet.student_id).first()
                    if student:
                        student.wallet_balance = expected

        for row in db.query(Transaction).filter(Transaction.wallet_id.is_(None)).all():
            wallet = db.query(Wallet).filter(Wallet.student_id == row.student_id).first()
            if wallet is not None and args.apply:
                row.wallet_id = wallet.id

        for student_id, current, expected, difference, involved in mismatches:
            print(f"{student_id}: current={current:.2f} expected={expected:.2f} difference={difference:.2f}")
            print("  ledger: " + (", ".join(involved) if involved else "(none)"))
        if args.apply:
            db.commit()
        else:
            db.rollback()
        print(f"Checked {db.query(Wallet).count()} wallets; mismatches={len(mismatches)}; mode={'APPLY' if args.apply else 'DRY-RUN'}")
        return 1 if mismatches and not args.apply else 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
