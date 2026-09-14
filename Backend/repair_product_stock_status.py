"""Find and repair products whose stock and status disagree.

Run with --dry-run first when checking a production database:
    python repair_product_stock_status.py --dry-run
"""

import argparse

from app.database import SessionLocal
from app.models import Product


AVAILABLE_STATUSES = {"approved", "available"}


def repair_products(dry_run=False):
    db = SessionLocal()
    repaired = []
    try:
        products = db.query(Product).all()
        for product in products:
            stock = int(product.stock or 0)
            status = str(product.status or "").strip()
            normalized_status = status.lower()
            next_status = None
            if stock == 0 and normalized_status in AVAILABLE_STATUSES:
                next_status = "Sold"
            elif stock > 0 and normalized_status == "sold":
                next_status = "Approved"

            if next_status:
                repaired.append((product.id, product.title, stock, status, next_status))
                if not dry_run:
                    product.status = next_status

        if not dry_run:
            db.commit()
        return repaired
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repair inconsistent product stock/status records.")
    parser.add_argument("--dry-run", action="store_true", help="Report repairs without writing changes.")
    args = parser.parse_args()
    changes = repair_products(dry_run=args.dry_run)
    action = "Would repair" if args.dry_run else "Repaired"
    print(f"{action} {len(changes)} product(s).")
    for product_id, title, stock, old_status, new_status in changes:
        print(f"#{product_id} {title!r}: stock={stock}, {old_status!r} -> {new_status!r}")
