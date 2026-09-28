from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from .models import Student, Transaction, Wallet

logger = logging.getLogger("app.wallets")

CREDIT_TRANSACTION_TYPES = {"Wallet Deposit", "Refund", "Escrow Release"}
DEBIT_TRANSACTION_TYPES = {"Product Purchase", "Wallet Withdrawal", "Escrow Hold", "Seller Payout"}


def _money(value: object) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _balance_delta(transaction_type: str, amount: Decimal) -> Decimal:
    if transaction_type in CREDIT_TRANSACTION_TYPES:
        return amount
    if transaction_type in DEBIT_TRANSACTION_TYPES:
        return -amount
    raise ValueError(f"Unsupported wallet transaction type: {transaction_type}")


def apply_transaction(
    db: Session,
    *,
    student_id: str,
    tx_id: str,
    transaction_type: str,
    amount: Decimal,
    description: str,
    status: str = "Successful",
    transaction: Optional[Transaction] = None,
    apply_balance: bool = True,
) -> tuple[Transaction, Wallet, bool]:
    """Lock a wallet, apply one ledger entry, and return whether it was newly applied."""
    # Ledger amounts are stored as magnitudes; transaction type determines
    # whether the balance delta is a credit or a debit.
    amount = abs(_money(amount))

    transaction = transaction or db.query(Transaction).filter(
        Transaction.tx_id == tx_id,
    ).with_for_update().first()
    if transaction is not None and transaction.status == "Successful" and transaction.wallet_id:
        wallet = db.query(Wallet).filter(Wallet.id == transaction.wallet_id).with_for_update().first()
        if wallet is None:
            raise ValueError(f"Wallet {transaction.wallet_id} is missing for transaction {tx_id}")
        return transaction, wallet, False

    student = db.query(Student).filter(
        Student.student_id == student_id,
    ).with_for_update().first()
    if student is None:
        raise ValueError(f"Student {student_id} not found for wallet transaction {tx_id}")

    wallet = db.query(Wallet).filter(
        Wallet.student_id == student_id,
    ).with_for_update().first()
    if wallet is None:
        wallet = Wallet(student_id=student_id, balance=_money(student.wallet_balance))
        db.add(wallet)
        db.flush()

    if transaction is not None and transaction.status == "Successful":
        transaction.wallet_id = wallet.id
        return transaction, wallet, False

    if apply_balance:
        wallet.balance = (_money(wallet.balance) + _balance_delta(transaction_type, amount)).quantize(Decimal("0.01"))
        wallet.updated_at = datetime.now(timezone.utc)
        student.wallet_balance = wallet.balance

    if transaction is None:
        transaction = Transaction(
            student_id=student_id,
            wallet_id=wallet.id,
            tx_id=tx_id,
            type=transaction_type,
            amount=amount,
            description=description,
            status=status,
        )
        db.add(transaction)
    else:
        transaction.wallet_id = wallet.id
        transaction.type = transaction_type
        transaction.amount = amount
        transaction.description = description
        transaction.status = status

    return transaction, wallet, True
