import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.orders import OrdersService
from services.cart_items import Cart_itemsService as CartItemsService
from services.products import ProductsService
from services.payment import PaymentService, CheckoutSessionRequest, CheckoutError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])


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
            # Get product details to calculate price
            product = await products_service.get_by_id(item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            total_price = product.price * item.quantity

            # Create order with COD payment method
            order = await orders_service.create(
                {
                    "product_id": item.product_id,
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

            # Remove cart item
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
    """Place order with Stripe online payment"""
    try:
        user_id = str(current_user.id)
        orders_service = OrdersService(db)
        products_service = ProductsService(db)
        cart_service = CartItemsService(db)
        payment_service = PaymentService()
        order_ids = []
        total_amount = 0.0

        # Get frontend host for redirect URLs
        frontend_host = request.headers.get("App-Host")
        if frontend_host and not frontend_host.startswith(("http://", "https://")):
            frontend_host = f"https://{frontend_host}"

        # Use frontend-provided URLs as primary, fall back to App-Host header
        if data.success_url and data.cancel_url:
            final_success_url = data.success_url
            final_cancel_url = data.cancel_url
        elif frontend_host:
            final_success_url = f"{frontend_host}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
            final_cancel_url = f"{frontend_host}/cart"
        else:
            # Last resort: use Referer or Origin header
            origin = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/")
            if origin:
                final_success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
                final_cancel_url = f"{origin}/cart"
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot determine redirect URLs. Please provide success_url and cancel_url."
                )

        logger.info(f"Stripe checkout URLs - success: {final_success_url}, cancel: {final_cancel_url}")

        # Create orders for each item
        for item in data.items:
            product = await products_service.get_by_id(item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            item_total = product.price * item.quantity
            total_amount += item_total

            order = await orders_service.create(
                {
                    "product_id": item.product_id,
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

        if not order_ids:
            raise HTTPException(status_code=400, detail="No orders were created")

        # Use the determined URLs for Stripe checkout
        success_url = final_success_url
        cancel_url = final_cancel_url

        checkout_request = CheckoutSessionRequest(
            amount=round(total_amount, 2),
            currency="usd",
            quantity=1,
            mode="payment",
            ui_mode="hosted",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "order_ids": ",".join(str(oid) for oid in order_ids),
                "user_id": user_id,
            },
        )

        session_response = await payment_service.create_checkout_session(checkout_request)

        # Update orders with stripe session ID
        for oid in order_ids:
            await orders_service.update(
                oid,
                {"stripe_session_id": session_response.session_id},
                user_id=user_id,
            )

        # Remove cart items after successful session creation
        for item in data.items:
            try:
                await cart_service.delete(item.cart_item_id, user_id=user_id)
            except Exception:
                logger.warning(f"Failed to delete cart item {item.cart_item_id}")

        return StripeCheckoutResponse(
            session_id=session_response.session_id,
            url=session_response.url,
            order_ids=order_ids,
        )
    except HTTPException:
        raise
    except CheckoutError as e:
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
    """Verify Stripe payment status and update orders"""
    try:
        user_id = str(current_user.id)
        payment_service = PaymentService()
        orders_service = OrdersService(db)

        # Get checkout session status
        status_response = await payment_service.get_checkout_status(data.session_id)

        # Map Stripe status to order status
        status_mapping = {
            "complete": "paid",
            "open": "pending",
            "expired": "cancelled",
        }
        order_status = status_mapping.get(status_response.status, "pending")

        # Get order IDs from metadata
        order_ids_str = status_response.metadata.get("order_ids", "")
        order_ids = [int(oid) for oid in order_ids_str.split(",") if oid.strip()]

        # Update all orders with the payment status
        for oid in order_ids:
            await orders_service.update(
                oid,
                {"status": order_status},
                user_id=user_id,
            )

        return VerifyPaymentResponse(
            status=order_status,
            payment_status=status_response.payment_status,
            order_ids=order_ids,
        )
    except CheckoutError as e:
        logger.error(f"Payment verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")
    except Exception as e:
        logger.error(f"Payment verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")