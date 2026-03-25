"""Stripe Connect integration for vendor onboarding and payment splits."""
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.vendors import VendorsService

logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/api/v1/stripe-connect", tags=["stripe-connect"])


# ---------- Request/Response Schemas ----------
class CreateConnectedAccountRequest(BaseModel):
    """Request to create a Stripe Connected Account for a vendor."""
    business_name: str
    email: str
    mobile_number: str
    description: str = ""
    business_type: str = ""


class CreateConnectedAccountResponse(BaseModel):
    """Response after creating a connected account."""
    vendor_id: int
    stripe_account_id: str
    onboarding_url: str


class OnboardingLinkRequest(BaseModel):
    """Request to get a new onboarding link for an existing vendor."""
    vendor_id: int


class OnboardingLinkResponse(BaseModel):
    """Response with onboarding URL."""
    onboarding_url: str


class ConnectStatusResponse(BaseModel):
    """Response with Stripe Connect account status."""
    vendor_id: int
    stripe_account_id: str
    charges_enabled: bool
    payouts_enabled: bool
    onboarding_complete: bool
    details_submitted: bool


# ---------- Routes ----------
@router.post("/create-account", response_model=CreateConnectedAccountResponse)
async def create_connected_account(
    data: CreateConnectedAccountRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Connected Account for a vendor and return onboarding URL."""
    try:
        user_id = str(current_user.id)
        vendors_service = VendorsService(db)

        # Check if vendor already exists
        existing = await vendors_service.get_list(user_id=user_id, limit=1)
        if existing["total"] > 0:
            vendor = existing["items"][0]
            if vendor.stripe_account_id:
                # Already has a Stripe account, just return a new onboarding link
                frontend_host = _get_frontend_host(request)
                account_link = stripe.AccountLink.create(
                    account=vendor.stripe_account_id,
                    refresh_url=f"{frontend_host}/vendor/signup?refresh=true",
                    return_url=f"{frontend_host}/vendor/signup?onboarding=complete",
                    type="account_onboarding",
                )
                return CreateConnectedAccountResponse(
                    vendor_id=vendor.id,
                    stripe_account_id=vendor.stripe_account_id,
                    onboarding_url=account_link.url,
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Vendor account already exists without Stripe. Please contact support.",
                )

        # Create Stripe Connected Account (Express type for simplicity)
        account = stripe.Account.create(
            type="express",
            country="AE",  # UAE
            email=data.email,
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            business_type="individual",
            metadata={
                "user_id": user_id,
                "business_name": data.business_name,
            },
        )

        # Create vendor record in database
        full_description = f"[{data.business_type}] {data.description}" if data.business_type else data.description
        vendor = await vendors_service.create(
            {
                "business_name": data.business_name,
                "email": data.email,
                "mobile_number": data.mobile_number,
                "stripe_account_id": account.id,
                "stripe_onboarding_complete": "no",
                "description": full_description,
                "commission_rate": 15.0,
                "status": "pending_onboarding",
                "total_sales": 0.0,
                "total_earnings": 0.0,
                "created_at": datetime.now(),
            },
            user_id=user_id,
        )

        # Create onboarding link
        frontend_host = _get_frontend_host(request)
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{frontend_host}/vendor/signup?refresh=true",
            return_url=f"{frontend_host}/vendor/signup?onboarding=complete",
            type="account_onboarding",
        )

        logger.info(f"Created Stripe Connected Account {account.id} for vendor {vendor.id}")

        return CreateConnectedAccountResponse(
            vendor_id=vendor.id,
            stripe_account_id=account.id,
            onboarding_url=account_link.url,
        )

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating connected account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating connected account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")


@router.post("/onboarding-link", response_model=OnboardingLinkResponse)
async def get_onboarding_link(
    data: OnboardingLinkRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a new Stripe onboarding link for an existing vendor."""
    try:
        user_id = str(current_user.id)
        vendors_service = VendorsService(db)

        vendor = await vendors_service.get_by_id(data.vendor_id, user_id=user_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        if not vendor.stripe_account_id:
            raise HTTPException(status_code=400, detail="No Stripe account linked to this vendor")

        frontend_host = _get_frontend_host(request)
        account_link = stripe.AccountLink.create(
            account=vendor.stripe_account_id,
            refresh_url=f"{frontend_host}/vendor/signup?refresh=true",
            return_url=f"{frontend_host}/vendor/signup?onboarding=complete",
            type="account_onboarding",
        )

        return OnboardingLinkResponse(onboarding_url=account_link.url)

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error getting onboarding link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting onboarding link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get onboarding link: {str(e)}")


@router.get("/status", response_model=ConnectStatusResponse)
async def get_connect_status(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check the Stripe Connect onboarding status for the current vendor."""
    try:
        user_id = str(current_user.id)
        vendors_service = VendorsService(db)

        existing = await vendors_service.get_list(user_id=user_id, limit=1)
        if existing["total"] == 0:
            raise HTTPException(status_code=404, detail="No vendor account found")

        vendor = existing["items"][0]
        if not vendor.stripe_account_id:
            raise HTTPException(status_code=400, detail="No Stripe account linked")

        # Retrieve account from Stripe to check status
        account = stripe.Account.retrieve(vendor.stripe_account_id)

        charges_enabled = account.charges_enabled
        payouts_enabled = account.payouts_enabled
        details_submitted = account.details_submitted
        onboarding_complete = charges_enabled and payouts_enabled and details_submitted

        # Update vendor status if onboarding is complete
        if onboarding_complete and vendor.stripe_onboarding_complete != "yes":
            await vendors_service.update(
                vendor.id,
                {
                    "stripe_onboarding_complete": "yes",
                    "status": "active",
                },
                user_id=user_id,
            )

        return ConnectStatusResponse(
            vendor_id=vendor.id,
            stripe_account_id=vendor.stripe_account_id,
            charges_enabled=charges_enabled,
            payouts_enabled=payouts_enabled,
            onboarding_complete=onboarding_complete,
            details_submitted=details_submitted,
        )

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error checking status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking connect status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


def _get_frontend_host(request: Request) -> str:
    """Extract frontend host from request headers."""
    frontend_host = request.headers.get("App-Host")
    if frontend_host and not frontend_host.startswith(("http://", "https://")):
        frontend_host = f"https://{frontend_host}"
    if not frontend_host:
        origin = request.headers.get("Origin") or request.headers.get("Referer", "").rstrip("/")
        frontend_host = origin or "https://localhost:5173"
    return frontend_host