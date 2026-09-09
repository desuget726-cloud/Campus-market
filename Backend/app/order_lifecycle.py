from __future__ import annotations

from typing import Optional

from fastapi import HTTPException


def apply_seller_order_action(order, action: str, input_code: Optional[int] = None) -> str:
    normalized_action = str(action or "").strip().lower().replace(" ", "_")
    order_status = str(order.status or "").strip().lower()
    if normalized_action == "accept":
        if order_status != "pending":
            raise HTTPException(status_code=409, detail="Only pending orders can be accepted.")
        order.status = "Processing"
        return "Order accepted and processing started."
    if normalized_action == "ready":
        if order_status != "processing":
            raise HTTPException(status_code=409, detail="Order must be processing before it can be marked ready.")
        order.status = "Ready for Pickup"
        return "Order marked ready for pickup."
    if normalized_action in {"handover", "verify_pickup"}:
        if order_status != "ready for pickup":
            raise HTTPException(status_code=409, detail="Order must be ready before handover confirmation.")
        if order.seller_confirmed:
            raise HTTPException(status_code=409, detail="Seller handover has already been confirmed.")
        if input_code is None or int(order.pickup_code or 0) != int(input_code):
            raise HTTPException(status_code=400, detail="Invalid pickup code.")
        order.seller_confirmed = True
        return "Handover confirmed. Waiting for buyer to confirm the item was received."
    if normalized_action == "reject":
        if order_status != "pending":
            raise HTTPException(status_code=409, detail="Only pending orders can be rejected.")
        order.status = "Cancelled"
        return "Order rejected."
    raise HTTPException(status_code=400, detail="Seller action must be accept, ready, handover, or reject.")


def apply_buyer_receipt_confirmation(order) -> None:
    if order.buyer_confirmed:
        raise HTTPException(status_code=409, detail="Buyer receipt has already been confirmed.")
    if str(order.status or "").strip().lower() == "disputed":
        raise HTTPException(status_code=409, detail="Receipt confirmation is disabled while this order has an active dispute.")
    if str(order.status or "").strip().lower() != "ready for pickup":
        raise HTTPException(status_code=409, detail="The order is not ready for receipt confirmation.")
    if not order.seller_confirmed:
        raise HTTPException(status_code=409, detail="Seller handover must be confirmed before receipt.")
    order.buyer_confirmed = True
    order.status = "Completed"


def payout_release_allowed(order) -> bool:
    return bool(
        str(order.status or "").strip().lower() == "completed"
        and order.buyer_confirmed
        and order.seller_confirmed
        and not bool(getattr(order, "active_dispute", False))
    )
