"""Payment processing with Stripe Connect split payments (85% vendor / 15% platform)."""
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.orders import OrdersService
from services.cart_items import Cart_itemsService as CartItemsService
from services.products import ProductsService
from services.vendors import VendorsService

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])

PLATFORM_COMMISSION_PERCENT = 15  # Platform keeps 15%, vendor gets 85%


# ---------- Request/Response Schemas ----------
class CartCheckoutItem(BaseModel):
    cart_item_id: int
    product_id: int
    quantity: int


class CODCheckoutRequest(BaseModel):
    """Cash on Delivery checkout request"""
    items: List[CartCheckoutItem]
    shipping_address: str
    phone_number: str


class StripeCheckoutRequest(BaseModel):
    """Stripe online payment checkout request"""
    items: List[CartCheckoutItem]
    shipping_address: str
    phone_number: str
    success_url: str
    cancel_url: str


class CODCheckoutResponse(BaseModel):
    message: str
    order_ids: List[int]


class StripeCheckoutResponse(BaseModel):
    session_id: str
    url: str
    order_ids: List[int]


class VerifyPaymentRequest(BaseModel):
    session_id: str


class VerifyPaymentResponse(BaseModel):
    status: str
    payment_status: str
    order_ids: List[int]


def _get_frontend_host(request: Request) -> str:
    """Extract frontend host from request headers."""
    frontend_host = request.headers.get("App-Host")
    if frontend_host and not frontend_host.startswith(("http://", "https://")):
        frontend_host = f"https://{frontend_host}"
    if not frontend_host:
        origin = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/")
        frontend_host = origin or ""
    return frontend_host


# ---------- Routes ----------
@router.post("/checkout/cod", response_model=CODCheckoutResponse)
async def checkout_cod(
    data: CODCheckoutRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Place order with Cash on Delivery payment method"""
    try:
        user_id = str(current_user.id)
        orders_service = OrdersService(db)
        cart_service = CartItemsService(db)
        products_service = ProductsService(db)
        order_ids = []

        for item in data.items:
            product = await products_service.get_by_id(item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            total_price = product.price * item.quantity

            order = await orders_service.create(
                {
                    "product_id": item.product_id,
                    "seller_id": product.seller_id or "",
                    "quantity": item.quantity,
                    "total_price": total_price,
                    "status": "confirmed",
                    "payment_method": "cod",
                    "shipping_address": data.shipping_address,
                    "phone_number": data.phone_number,
                    "created_at": datetime.now(),
                },
                user_id=user_id,
            )
            if order:
                order_ids.append(order.id)

            try:
                await cart_service.delete(item.cart_item_id, user_id=user_id)
            except Exception:
                logger.warning(f"Failed to delete cart item {item.cart_item_id}")

        return CODCheckoutResponse(
            message="Order placed successfully! Pay on delivery.",
            order_ids=order_ids,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"COD checkout error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


@router.post("/checkout/stripe", response_model=StripeCheckoutResponse)
async def checkout_stripe(
    data: StripeCheckoutRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Place order with Stripe payment - splits 85% to vendor, 15% to platform."""
    try:
        user_id = str(current_user.id)
        orders_service = OrdersService(db)
        products_service = ProductsService(db)
        cart_service = CartItemsService(db)
        vendors_service = VendorsService(db)
        order_ids = []
        line_items = []
        total_amount = 0.0

        # Get frontend host for redirect URLs
        frontend_host = _get_frontend_host(request)

        if data.success_url and data.cancel_url:
            final_success_url = data.success_url
            final_cancel_url = data.cancel_url
        elif frontend_host:
            final_success_url = f"{frontend_host}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
            final_cancel_url = f"{frontend_host}/cart"
        else:
            raise HTTPException(
                status_code=400,
                detail="Cannot determine redirect URLs. Please provide success_url and cancel_url.",
            )

        logger.info(f"Stripe checkout URLs - success: {final_success_url}, cancel: {final_cancel_url}")

        # Collect vendor stripe account IDs for payment splitting
        vendor_stripe_account = None
        vendor_total = 0.0

        for item in data.items:
            product = await products_service.get_by_id(item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            item_total = product.price * item.quantity
            total_amount += item_total

            # Try to find vendor's Stripe Connect account via seller_id
            if product.seller_id:
                vendor_list = await vendors_service.get_list(
                    user_id=product.seller_id, limit=1
                )
                if vendor_list["total"] > 0:
                    v = vendor_list["items"][0]
                    if v.stripe_account_id and v.stripe_onboarding_complete == "yes":
                        vendor_stripe_account = v.stripe_account_id
                        vendor_total += item_total

            # Create order
            order = await orders_service.create(
                {
                    "product_id": item.product_id,
                    "seller_id": product.seller_id or "",
                    "quantity": item.quantity,
                    "total_price": item_total,
                    "status": "pending",
                    "payment_method": "stripe",
                    "shipping_address": data.shipping_address,
                    "phone_number": data.phone_number,
                    "created_at": datetime.now(),
                },
                user_id=user_id,
            )
            if order:
                order_ids.append(order.id)

            # Build line items for Stripe
            line_items.append({
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": product.title[:200],
                    },
                    "unit_amount": int(product.price * 100),  # Stripe uses cents
                },
                "quantity": item.quantity,
            })

        if not order_ids:
            raise HTTPException(status_code=400, detail="No orders were created")

        # Build Stripe checkout session params
        session_params = {
            "payment_method_types": ["card"],
            "line_items": line_items,
            "mode": "payment",
            "success_url": final_success_url,
            "cancel_url": final_cancel_url,
            "metadata": {
                "order_ids": ",".join(str(oid) for oid in order_ids),
                "user_id": user_id,
            },
        }

        # If vendor has Stripe Connect, use payment_intent_data for split
        if vendor_stripe_account and vendor_total > 0:
            # Vendor gets 85%, platform keeps 15%
            platform_fee = int(vendor_total * 100 * PLATFORM_COMMISSION_PERCENT / 100)
            session_params["payment_intent_data"] = {
                "application_fee_amount": platform_fee,
                "transfer_data": {
                    "destination": vendor_stripe_account,
                },
            }
            logger.info(
                f"Stripe Connect split: total={total_amount}, "
                f"platform_fee={platform_fee/100}, vendor_account={vendor_stripe_account}"
            )

        session = stripe.checkout.Session.create(**session_params)

        # Update orders with stripe session ID
        for oid in order_ids:
            await orders_service.update(
                oid,
                {"stripe_session_id": session.id},
                user_id=user_id,
            )

        # Remove cart items
        for item in data.items:
            try:
                await cart_service.delete(item.cart_item_id, user_id=user_id)
            except Exception:
                logger.warning(f"Failed to delete cart item {item.cart_item_id}")

        return StripeCheckoutResponse(
            session_id=session.id,
            url=session.url,
            order_ids=order_ids,
        )
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Payment session creation failed: {str(e)}")
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")


@router.post("/verify", response_model=VerifyPaymentResponse)
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Stripe payment status and update orders."""
    try:
        user_id = str(current_user.id)
        orders_service = OrdersService(db)

        session = stripe.checkout.Session.retrieve(data.session_id)

        status_mapping = {
            "complete": "paid",
            "open": "pending",
            "expired": "cancelled",
        }
        order_status = status_mapping.get(session.status, "pending")

        order_ids_str = session.metadata.get("order_ids", "")
        order_ids = [int(oid) for oid in order_ids_str.split(",") if oid.strip()]

        # Update all orders with the payment status
        for oid in order_ids:
            await orders_service.update(
                oid,
                {"status": order_status},
                user_id=user_id,
            )

        # If payment is complete, update vendor earnings
        if order_status == "paid":
            vendors_service = VendorsService(db)
            for oid in order_ids:
                order = await orders_service.get_by_id(oid, user_id=user_id)
                if order and order.seller_id:
                    vendor_list = await vendors_service.get_list(
                        user_id=order.seller_id, limit=1
                    )
                    if vendor_list["total"] > 0:
                        vendor = vendor_list["items"][0]
                        vendor_earning = order.total_price * (100 - PLATFORM_COMMISSION_PERCENT) / 100
                        await vendors_service.update(
                            vendor.id,
                            {
                                "total_sales": (vendor.total_sales or 0) + order.total_price,
                                "total_earnings": (vendor.total_earnings or 0) + vendor_earning,
                            },
                            user_id=order.seller_id,
                        )

        return VerifyPaymentResponse(
            status=order_status,
            payment_status=session.payment_status,
            order_ids=order_ids,
        )
    except stripe.error.StripeError as e:
        logger.error(f"Payment verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")
    except Exception as e:
        logger.error(f"Payment verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")