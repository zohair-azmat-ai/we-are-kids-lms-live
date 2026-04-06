from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import stripe
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from livekit.api import AccessToken, VideoGrants
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.ai_service import answer_ai_chat, get_ai_insights
from app.auth import authenticate_user, create_access_token, get_current_user, hash_password
from app.config import (
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
    OPENAI_API_KEY,
    STRIPE_PRICE_PREMIUM,
    STRIPE_PRICE_STANDARD,
    STRIPE_PRICE_STARTER,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    UPLOAD_DIR,
)
from app.db import SessionLocal
from app.models import BillingAccount, Classroom, Enrollment, LiveSession, Recording, User
from app.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIInsightsResponse,
    AuthLoginRequest,
    AuthLoginResponse,
    AuthRegisterRequest,
    AuthUser,
    AdminAnalyticsResponse,
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingCustomerPortalRequest,
    BillingCustomerPortalResponse,
    BillingSubscription,
    BillingSubscriptionRequest,
    BillingUsageSummary,
    ClassCreateRequest,
    ClassSummary,
    ClassroomPresenceRequest,
    ClassUpdateRequest,
    EndClassRequest,
    LiveClass,
    LiveKitTokenRequest,
    LiveKitTokenResponse,
    LiveSessionSummary,
    RecordingDeleteResponse,
    RecordingItem,
    RecordingUpdateRequest,
    RecordingUpdateResponse,
    StartClassRequest,
    StudentCreateRequest,
    StudentSummary,
    TeacherAnalyticsResponse,
    StudentUpdateRequest,
    SuccessResponse,
    TeacherCreateRequest,
    TeacherSummary,
    TeacherUpdateRequest,
)
from app.services import (
    build_billing_subscription,
    build_billing_usage_summary,
    build_admin_analytics,
    build_class_summary,
    build_live_class_response,
    build_live_session_summary,
    build_student_summary,
    build_teacher_summary,
    build_teacher_analytics,
    cleanup_expired_recordings,
    delete_recording_file,
    get_active_session_for_class,
    get_billing_account_by_customer_id,
    get_billing_account_by_subscription_id,
    get_class,
    get_live_or_scheduled_class,
    get_or_create_billing_account,
    get_or_create_live_session,
    get_student,
    get_teacher,
    get_teacher_by_email,
    get_user_by_email_and_role,
    get_user_by_name_and_role,
    is_student_enrolled_in_class,
    mark_class_as_ended,
    normalize_email,
    require_admin_user,
    require_plan_capacity,
    serialize_recording,
    update_billing_account_from_subscription,
    update_live_session_presence,
    utc_now,
    validate_class_relationships,
    validate_unique_user_email,
)


api_router = APIRouter(prefix="/api/v1", tags=["v1"])
RECORDINGS_DIR = UPLOAD_DIR / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

STRIPE_PRICE_MAP = {
    "starter": STRIPE_PRICE_STARTER,
    "standard": STRIPE_PRICE_STANDARD,
    "premium": STRIPE_PRICE_PREMIUM,
}
STRIPE_PRICE_TO_PLAN = {
    price_id: plan
    for plan, price_id in STRIPE_PRICE_MAP.items()
    if price_id
}

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def require_livekit_config() -> None:
    if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Live classroom service is not configured yet. Please add LiveKit environment variables.",
        )


def require_stripe_config() -> None:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured yet. Please add Stripe environment variables.",
        )


def require_ai_access(current_user: User) -> None:
    if current_user.role not in {"admin", "teacher"}:
        raise HTTPException(
            status_code=403,
            detail="AI assistant access is limited to admins and teachers.",
        )


def require_ai_config() -> None:
    if not OPENAI_API_KEY:
        return


def serialize_auth_user(user: User) -> AuthUser:
    return AuthUser(
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
    )


def resolve_classroom_user(
    db: Session,
    *,
    role: str,
    participant_email: str | None,
    participant_name: str | None,
) -> User:
    user: User | None = None

    if participant_email:
        user = get_user_by_email_and_role(db, participant_email, role)

    if not user and participant_name:
        user = get_user_by_name_and_role(db, participant_name, role)

    if not user:
        raise HTTPException(status_code=403, detail="Unable to verify classroom access.")

    return user


def validate_classroom_access(
    db: Session,
    *,
    class_id: str,
    role: str,
    participant_email: str | None,
    participant_name: str | None,
    allow_teacher_start: bool = False,
) -> tuple[Classroom, User, LiveSession]:
    classroom = get_class(db, class_id)

    if not classroom or not classroom.teacher:
        raise HTTPException(status_code=404, detail="Classroom not found.")

    user = resolve_classroom_user(
        db,
        role=role,
        participant_email=participant_email,
        participant_name=participant_name,
    )

    if role == "teacher":
        if classroom.teacher_id != user.id:
            raise HTTPException(status_code=403, detail="Teacher access denied for this class.")

        session = get_active_session_for_class(db, class_id)

        if not session and allow_teacher_start:
            session = get_or_create_live_session(db, classroom, user)

        if not session:
            raise HTTPException(status_code=404, detail="No live session found for this class.")

        return classroom, user, session

    if not is_student_enrolled_in_class(db, class_id, user.id):
        raise HTTPException(status_code=403, detail="Student access denied for this class.")

    session = get_active_session_for_class(db, class_id)

    if not session:
        raise HTTPException(status_code=404, detail="No live session found right now.")

    return classroom, user, session


def resolve_subscription_period_end(subscription: stripe.Subscription) -> datetime | None:
    period_end = getattr(subscription, "current_period_end", None)

    if isinstance(period_end, int):
        return datetime.fromtimestamp(period_end, tz=timezone.utc)

    return None


def resolve_plan_from_subscription(subscription: stripe.Subscription) -> str | None:
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) or []

    for item in data:
        price = getattr(item, "price", None)
        price_id = getattr(price, "id", None)

        if price_id in STRIPE_PRICE_TO_PLAN:
            return STRIPE_PRICE_TO_PLAN[price_id]

    return None


def sync_account_from_subscription(
    db: Session,
    account: BillingAccount,
    subscription: stripe.Subscription,
) -> None:
    update_billing_account_from_subscription(
        account,
        customer_id=str(getattr(subscription, "customer", "") or "") or None,
        subscription_id=getattr(subscription, "id", None),
        plan=resolve_plan_from_subscription(subscription),
        status=getattr(subscription, "status", None),
        current_period_end=resolve_subscription_period_end(subscription),
    )
    db.commit()
    db.refresh(account)


def handle_checkout_completed(session: stripe.checkout.Session) -> None:
    customer_id = getattr(session, "customer", None)
    subscription_id = getattr(session, "subscription", None)
    metadata = getattr(session, "metadata", None) or {}
    account_id = metadata.get("account_id")

    with SessionLocal() as db:
        account: BillingAccount | None = None

        if customer_id:
            account = get_billing_account_by_customer_id(db, str(customer_id))

        if not account and account_id:
            account = db.get(BillingAccount, account_id)

        if not account:
            return

        if customer_id:
            account.stripe_customer_id = str(customer_id)

        if subscription_id:
            subscription = stripe.Subscription.retrieve(str(subscription_id))
            sync_account_from_subscription(db, account, subscription)
            return

        db.commit()


def handle_subscription_event(subscription: stripe.Subscription) -> None:
    with SessionLocal() as db:
        account = None
        customer_id = getattr(subscription, "customer", None)

        if customer_id:
            account = get_billing_account_by_customer_id(db, str(customer_id))

        if not account:
            account = get_billing_account_by_subscription_id(db, getattr(subscription, "id", ""))

        if not account:
            return

        sync_account_from_subscription(db, account, subscription)


@api_router.get("/test")
def get_test_payload() -> dict:
    return {
        "message": "School LMS Live API is connected.",
        "version": "v1",
        "features": [
            "teachers",
            "students",
            "admin",
            "live-classes-ready",
            "postgres-ready",
            "livekit-ready",
            "stripe-billing-ready",
        ],
    }


@api_router.post("/auth/login", response_model=AuthLoginResponse)
def login(payload: AuthLoginRequest) -> AuthLoginResponse:
    cleaned_email = payload.email.strip().lower()
    cleaned_password = payload.password.strip()

    if not cleaned_email or not cleaned_password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    with SessionLocal() as db:
        user = authenticate_user(db, cleaned_email, cleaned_password, payload.role)

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid login details. Please check your email, password, and role.",
            )

        access_token, expires_at = create_access_token(subject=user.email, role=user.role)
        return AuthLoginResponse(
            access_token=access_token,
            expires_at=expires_at,
            user=serialize_auth_user(user),
        )


@api_router.post("/auth/register", response_model=AuthUser)
def register(payload: AuthRegisterRequest, current_user: User = Depends(get_current_user)) -> AuthUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create new users.")

    cleaned_name = payload.name.strip()
    cleaned_email = payload.email.strip().lower()
    cleaned_password = payload.password.strip()

    if not cleaned_name or not cleaned_email or not cleaned_password:
        raise HTTPException(status_code=400, detail="Name, email, and password are required.")

    if len(cleaned_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    with SessionLocal() as db:
        validate_unique_user_email(db, cleaned_email, payload.role)
        user = User(
            id=f"{payload.role}-{uuid4().hex[:8]}",
            name=cleaned_name,
            email=normalize_email(cleaned_email),
            password=hash_password(cleaned_password),
            role=payload.role,
            status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return serialize_auth_user(user)


@api_router.get("/auth/me", response_model=AuthUser)
def get_auth_me(current_user: User = Depends(get_current_user)) -> AuthUser:
    return serialize_auth_user(current_user)


@api_router.get("/classes/live", response_model=list[LiveClass])
def get_live_classes(current_user: User = Depends(get_current_user)) -> list[LiveClass]:
    with SessionLocal() as db:
        sessions = db.scalars(
            select(LiveSession)
            .where(LiveSession.status == "live")
            .order_by(LiveSession.started_at.desc())
        ).all()

        live_classes: list[LiveClass] = []

        for session in sessions:
            classroom = get_class(db, session.class_id)

            if classroom:
                live_classes.append(build_live_class_response(classroom, session))

        return live_classes


@api_router.post("/classes/start", response_model=LiveClass)
def start_class_session(
    payload: StartClassRequest,
    current_user: User = Depends(get_current_user),
) -> LiveClass:
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can start live classes.")

    if normalize_email(payload.teacher_email) != current_user.email:
        raise HTTPException(status_code=403, detail="Teacher access denied for this class.")

    with SessionLocal() as db:
        teacher = get_teacher_by_email(db, payload.teacher_email)

        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found.")

        classroom = db.scalar(
            select(Classroom)
            .options(selectinload(Classroom.teacher))
            .where(Classroom.teacher_id == teacher.id)
            .order_by(Classroom.created_at.asc())
        )

        if not classroom:
            raise HTTPException(status_code=404, detail="Teacher class not found.")

        session = get_or_create_live_session(db, classroom, teacher)
        return build_live_class_response(classroom, session)


@api_router.post("/classes/{class_id}/end", response_model=SuccessResponse)
def end_teacher_class_session(
    class_id: str,
    payload: EndClassRequest,
    current_user: User = Depends(get_current_user),
) -> SuccessResponse:
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can end live classes.")

    if normalize_email(payload.teacher_email) != current_user.email:
        raise HTTPException(status_code=403, detail="Teacher access denied for this class.")

    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found.")

        teacher = get_teacher_by_email(db, payload.teacher_email)

        if not teacher or classroom.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Teacher access denied for this class.")

    session = mark_class_as_ended(class_id)

    if not session or session.status != "ended":
        raise HTTPException(status_code=404, detail="Live session not found.")

    return SuccessResponse(success=True, message="Live session ended successfully.")


@api_router.post("/classes/{class_id}/presence/join", response_model=LiveClass)
def join_class_presence(
    class_id: str,
    payload: ClassroomPresenceRequest,
    current_user: User = Depends(get_current_user),
) -> LiveClass:
    if payload.role != current_user.role:
        raise HTTPException(status_code=403, detail="Classroom role mismatch.")

    with SessionLocal() as db:
        validate_classroom_access(
            db,
            class_id=class_id,
            role=payload.role,
            participant_email=current_user.email,
            participant_name=current_user.name,
            allow_teacher_start=payload.role == "teacher",
        )

    session = update_live_session_presence(class_id, 1)

    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")

    return session


@api_router.post("/classes/{class_id}/presence/leave", response_model=LiveClass)
def leave_class_presence(
    class_id: str,
    payload: ClassroomPresenceRequest,
    current_user: User = Depends(get_current_user),
) -> LiveClass:
    if payload.role != current_user.role:
        raise HTTPException(status_code=403, detail="Classroom role mismatch.")

    with SessionLocal() as db:
        validate_classroom_access(
            db,
            class_id=class_id,
            role=payload.role,
            participant_email=current_user.email,
            participant_name=current_user.name,
            allow_teacher_start=False,
        )

    session = update_live_session_presence(class_id, -1)

    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")

    return session


@api_router.get("/classes/{class_id}", response_model=LiveClass)
def get_class_session(class_id: str, current_user: User = Depends(get_current_user)) -> LiveClass:
    if current_user.role not in {"teacher", "student"}:
        raise HTTPException(status_code=403, detail="Classroom access is limited to teachers and students.")

    with SessionLocal() as db:
        validate_classroom_access(
            db,
            class_id=class_id,
            role=current_user.role,
            participant_email=current_user.email,
            participant_name=current_user.name,
            allow_teacher_start=current_user.role == "teacher",
        )

    session = get_live_or_scheduled_class(class_id)

    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")

    return session


@api_router.post("/livekit/token", response_model=LiveKitTokenResponse)
def create_livekit_token(
    payload: LiveKitTokenRequest,
    current_user: User = Depends(get_current_user),
) -> LiveKitTokenResponse:
    require_livekit_config()
    if payload.role != current_user.role:
        raise HTTPException(status_code=403, detail="Classroom role mismatch.")

    with SessionLocal() as db:
        classroom, user, _ = validate_classroom_access(
            db,
            class_id=payload.room_name,
            role=payload.role,
            participant_email=current_user.email,
            participant_name=current_user.name,
            allow_teacher_start=payload.role == "teacher",
        )

        token = (
            AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(user.email)
            .with_name(user.name)
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=classroom.id,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
            .to_jwt()
        )

        return LiveKitTokenResponse(
            token=token,
            url=LIVEKIT_URL,
            room_name=classroom.id,
            participant_name=user.name,
        )


@api_router.post("/billing/checkout-session", response_model=BillingCheckoutResponse)
def create_billing_checkout_session(
    payload: BillingCheckoutRequest,
    current_user: User = Depends(get_current_user),
) -> BillingCheckoutResponse:
    require_stripe_config()
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required for billing.")

    price_id = STRIPE_PRICE_MAP.get(payload.plan)

    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe price is not configured for the {payload.plan} plan.",
        )

    app_url = payload.app_url.rstrip("/")

    if not app_url.startswith("http://") and not app_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="A valid app URL is required.")

    with SessionLocal() as db:
        admin_user = require_admin_user(db, payload.admin_email)

        if admin_user.email != current_user.email:
            raise HTTPException(status_code=403, detail="Admin access is required for billing.")

        account = get_or_create_billing_account(db)
        account.billing_email = admin_user.email
        db.commit()
        db.refresh(account)

        customer_id = account.stripe_customer_id

        if not customer_id:
            customer = stripe.Customer.create(
                email=admin_user.email,
                name=account.school_name,
                metadata={"account_id": account.id},
            )
            account.stripe_customer_id = customer.id
            db.commit()
            db.refresh(account)
            customer_id = customer.id

        checkout_session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{app_url}/admin/billing?checkout=success",
            cancel_url=f"{app_url}/pricing?checkout=cancelled",
            metadata={
                "account_id": account.id,
                "plan": payload.plan,
                "admin_email": admin_user.email,
            },
            subscription_data={
                "metadata": {
                    "account_id": account.id,
                    "plan": payload.plan,
                }
            },
            allow_promotion_codes=True,
        )

        if not checkout_session.url:
            raise HTTPException(status_code=500, detail="Unable to create checkout session.")

        return BillingCheckoutResponse(checkout_url=checkout_session.url)


@api_router.get("/billing/subscription", response_model=BillingSubscription)
def get_billing_subscription(
    admin_email: str,
    current_user: User = Depends(get_current_user),
) -> BillingSubscription:
    with SessionLocal() as db:
        admin_user = require_admin_user(db, admin_email)

        if admin_user.email != current_user.email:
            raise HTTPException(status_code=403, detail="Admin access is required for billing.")

        account = get_or_create_billing_account(db)
        return build_billing_subscription(db, account)


@api_router.get("/billing/usage", response_model=BillingUsageSummary)
def get_billing_usage(
    admin_email: str,
    current_user: User = Depends(get_current_user),
) -> BillingUsageSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required for billing.")

    with SessionLocal() as db:
        admin_user = require_admin_user(db, admin_email)

        if admin_user.email != current_user.email:
            raise HTTPException(status_code=403, detail="Admin access is required for billing.")

        account = get_or_create_billing_account(db)
        return build_billing_usage_summary(db, account)


@api_router.post("/billing/customer-portal", response_model=BillingCustomerPortalResponse)
def create_customer_portal_session(
    payload: BillingCustomerPortalRequest,
    current_user: User = Depends(get_current_user),
) -> BillingCustomerPortalResponse:
    require_stripe_config()
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required for billing.")

    app_url = payload.app_url.rstrip("/")

    if not app_url.startswith("http://") and not app_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="A valid app URL is required.")

    with SessionLocal() as db:
        admin_user = require_admin_user(db, payload.admin_email)

        if admin_user.email != current_user.email:
            raise HTTPException(status_code=403, detail="Admin access is required for billing.")

        account = get_or_create_billing_account(db)

        if not account.stripe_customer_id:
            raise HTTPException(
                status_code=400,
                detail="No Stripe customer was found for this school yet.",
            )

        portal_session = stripe.billing_portal.Session.create(
            customer=account.stripe_customer_id,
            return_url=f"{app_url}/admin/billing",
        )

        return BillingCustomerPortalResponse(portal_url=portal_session.url)


@api_router.post("/billing/webhook")
async def handle_billing_webhook(request: Request) -> JSONResponse:
    require_stripe_config()

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=signature,
                secret=STRIPE_WEBHOOK_SECRET,
            )
        else:
            event = stripe.Event.construct_from(await request.json(), stripe.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload.") from exc
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.") from exc

    event_type = event["type"]
    event_object = event["data"]["object"]

    if event_type == "checkout.session.completed":
        handle_checkout_completed(event_object)
    elif event_type == "customer.subscription.updated":
        handle_subscription_event(event_object)
    elif event_type == "customer.subscription.deleted":
        handle_subscription_event(event_object)

    return JSONResponse({"received": True})


@api_router.post("/ai/chat", response_model=AIChatResponse)
def post_ai_chat(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
) -> AIChatResponse:
    require_ai_access(current_user)
    require_ai_config()

    cleaned_question = payload.question.strip()

    if not cleaned_question:
        raise HTTPException(status_code=400, detail="Please enter a question for the assistant.")

    with SessionLocal() as db:
        try:
            return answer_ai_chat(db, current_user, cleaned_question)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.get("/ai/insights", response_model=AIInsightsResponse)
def get_ai_insights_route(
    current_user: User = Depends(get_current_user),
) -> AIInsightsResponse:
    require_ai_access(current_user)
    require_ai_config()

    with SessionLocal() as db:
        return get_ai_insights(db, current_user)


@api_router.post("/recordings/upload", response_model=RecordingItem)
async def upload_recording(
    class_id: str = Form(...),
    teacher_name: str = Form(...),
    title: str = Form(...),
    recorded_file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> RecordingItem:
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can upload recordings.")

    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom or not classroom.teacher:
            raise HTTPException(status_code=404, detail="Class not found.")

        if classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Teacher access denied for this class.")

        recording_id = uuid4().hex
        file_suffix = Path(recorded_file.filename or "recording.webm").suffix or ".webm"
        file_name = f"{recording_id}{file_suffix}"
        destination_path = RECORDINGS_DIR / file_name
        file_bytes = await recorded_file.read()
        destination_path.write_bytes(file_bytes)

        created_at = utc_now()
        recording = Recording(
            id=recording_id,
            class_id=class_id,
            teacher_id=classroom.teacher_id,
            title=title.strip(),
            file_path=str(destination_path),
            created_at=created_at,
            expires_at=created_at + timedelta(days=5),
            status="available",
        )
        db.add(recording)
        db.commit()
        db.refresh(recording)
        return serialize_recording(recording, classroom.teacher)


@api_router.get("/recordings", response_model=list[RecordingItem])
def get_recordings(current_user: User = Depends(get_current_user)) -> list[RecordingItem]:
    cleanup_expired_recordings()

    with SessionLocal() as db:
        recordings = db.scalars(
            select(Recording)
            .options(selectinload(Recording.teacher))
            .order_by(Recording.created_at.desc())
        ).all()
        return [serialize_recording(recording) for recording in recordings]


@api_router.get("/recordings/{recording_id}", response_model=RecordingItem)
def get_recording_by_id(
    recording_id: str,
    current_user: User = Depends(get_current_user),
) -> RecordingItem:
    with SessionLocal() as db:
        recording = db.scalar(
            select(Recording)
            .options(selectinload(Recording.teacher))
            .where(Recording.id == recording_id)
        )

        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found.")

        if recording.expires_at <= utc_now():
            delete_recording_file(recording.file_path)
            db.delete(recording)
            db.commit()
            raise HTTPException(
                status_code=410,
                detail="This recording has expired and is no longer available.",
            )

        return serialize_recording(recording)


@api_router.patch("/recordings/{recording_id}", response_model=RecordingUpdateResponse)
def update_recording_by_id(
    recording_id: str,
    payload: RecordingUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> RecordingUpdateResponse:
    cleanup_expired_recordings()

    with SessionLocal() as db:
        recording = db.scalar(
            select(Recording)
            .options(selectinload(Recording.teacher))
            .where(Recording.id == recording_id)
        )

        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found.")

        if current_user.role == "teacher" and recording.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only update your own recordings.")

        if current_user.role not in {"admin", "teacher"}:
            raise HTTPException(status_code=403, detail="You do not have access to update recordings.")

        cleaned_title = payload.title.strip()

        if not cleaned_title:
            raise HTTPException(status_code=400, detail="Recording title is required.")

        recording.title = cleaned_title
        db.commit()
        db.refresh(recording)
        return RecordingUpdateResponse(success=True, recording=serialize_recording(recording))


@api_router.delete("/recordings/{recording_id}", response_model=RecordingDeleteResponse)
def delete_recording_by_id(
    recording_id: str,
    current_user: User = Depends(get_current_user),
) -> RecordingDeleteResponse:
    cleanup_expired_recordings()

    with SessionLocal() as db:
        recording = db.scalar(select(Recording).where(Recording.id == recording_id))

        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found.")

        if current_user.role == "teacher" and recording.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only delete your own recordings.")

        if current_user.role not in {"admin", "teacher"}:
            raise HTTPException(status_code=403, detail="You do not have access to delete recordings.")

        delete_recording_file(recording.file_path)
        db.delete(recording)
        db.commit()
        return RecordingDeleteResponse(success=True, recording_id=recording_id)


@api_router.get("/admin/teachers", response_model=list[TeacherSummary])
def get_admin_teachers(current_user: User = Depends(get_current_user)) -> list[TeacherSummary]:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        teachers = db.scalars(
            select(User).where(User.role == "teacher").order_by(User.name.asc())
        ).all()
        return [build_teacher_summary(db, teacher) for teacher in teachers]


@api_router.post("/admin/teachers", response_model=TeacherSummary)
def create_admin_teacher(
    payload: TeacherCreateRequest,
    current_user: User = Depends(get_current_user),
) -> TeacherSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        if not payload.password.strip():
            raise HTTPException(status_code=400, detail="Teacher password is required.")

        require_plan_capacity(db, "teachers")
        validate_unique_user_email(db, payload.email, "teacher")
        teacher = User(
            id=f"teacher-{uuid4().hex[:8]}",
            name=payload.name.strip(),
            email=normalize_email(payload.email),
            password=hash_password(payload.password.strip()),
            role="teacher",
            status=payload.status,
        )
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
        return build_teacher_summary(db, teacher)


@api_router.patch("/admin/teachers/{teacher_id}", response_model=TeacherSummary)
def update_admin_teacher(
    teacher_id: str,
    payload: TeacherUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> TeacherSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        teacher = get_teacher(db, teacher_id)

        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found.")

        if not payload.password.strip():
            raise HTTPException(status_code=400, detail="Teacher password is required.")

        validate_unique_user_email(db, payload.email, "teacher", exclude_user_id=teacher_id)
        teacher.name = payload.name.strip()
        teacher.email = normalize_email(payload.email)
        teacher.password = hash_password(payload.password.strip())
        teacher.status = payload.status
        db.commit()
        db.refresh(teacher)
        return build_teacher_summary(db, teacher)


@api_router.delete("/admin/teachers/{teacher_id}", response_model=SuccessResponse)
def delete_admin_teacher(
    teacher_id: str,
    current_user: User = Depends(get_current_user),
) -> SuccessResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        teacher = get_teacher(db, teacher_id)

        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found.")

        recordings = db.scalars(select(Recording).where(Recording.teacher_id == teacher_id)).all()

        for recording in recordings:
            delete_recording_file(recording.file_path)

        db.delete(teacher)
        db.commit()
        return SuccessResponse(success=True, message="Teacher deleted successfully.")


@api_router.get("/admin/students", response_model=list[StudentSummary])
def get_admin_students(current_user: User = Depends(get_current_user)) -> list[StudentSummary]:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        students = db.scalars(
            select(User).where(User.role == "student").order_by(User.name.asc())
        ).all()
        return [build_student_summary(db, student) for student in students]


@api_router.post("/admin/students", response_model=StudentSummary)
def create_admin_student(
    payload: StudentCreateRequest,
    current_user: User = Depends(get_current_user),
) -> StudentSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        if not payload.password.strip():
            raise HTTPException(status_code=400, detail="Student password is required.")

        require_plan_capacity(db, "students")
        validate_unique_user_email(db, payload.email, "student")
        student = User(
            id=f"student-{uuid4().hex[:8]}",
            name=payload.name.strip(),
            email=normalize_email(payload.email),
            password=hash_password(payload.password.strip()),
            role="student",
            status=payload.status,
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        return build_student_summary(db, student)


@api_router.patch("/admin/students/{student_id}", response_model=StudentSummary)
def update_admin_student(
    student_id: str,
    payload: StudentUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> StudentSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        student = get_student(db, student_id)

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        if not payload.password.strip():
            raise HTTPException(status_code=400, detail="Student password is required.")

        validate_unique_user_email(db, payload.email, "student", exclude_user_id=student_id)
        student.name = payload.name.strip()
        student.email = normalize_email(payload.email)
        student.password = hash_password(payload.password.strip())
        student.status = payload.status
        db.commit()
        db.refresh(student)
        return build_student_summary(db, student)


@api_router.delete("/admin/students/{student_id}", response_model=SuccessResponse)
def delete_admin_student(
    student_id: str,
    current_user: User = Depends(get_current_user),
) -> SuccessResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        student = get_student(db, student_id)

        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        db.delete(student)
        db.commit()
        return SuccessResponse(success=True, message="Student deleted successfully.")


@api_router.get("/admin/classes", response_model=list[ClassSummary])
def get_admin_classes(current_user: User = Depends(get_current_user)) -> list[ClassSummary]:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        classes = db.scalars(
            select(Classroom)
            .options(
                selectinload(Classroom.teacher),
                selectinload(Classroom.enrollments),
            )
            .order_by(Classroom.title.asc())
        ).all()
        return [build_class_summary(db, classroom) for classroom in classes]


@api_router.post("/admin/classes", response_model=ClassSummary)
def create_admin_class(
    payload: ClassCreateRequest,
    current_user: User = Depends(get_current_user),
) -> ClassSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        require_plan_capacity(db, "classes")
        validate_class_relationships(db, payload.teacher_id, payload.student_ids)
        classroom = Classroom(
            id=f"class-{uuid4().hex[:8]}",
            title=payload.title.strip(),
            teacher_id=payload.teacher_id,
            status=payload.status,
        )
        db.add(classroom)
        db.flush()

        for student_id in payload.student_ids:
            db.add(Enrollment(class_id=classroom.id, student_id=student_id))

        db.commit()
        classroom = get_class(db, classroom.id)

        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found.")

        return build_class_summary(db, classroom)


@api_router.patch("/admin/classes/{class_id}", response_model=ClassSummary)
def update_admin_class(
    class_id: str,
    payload: ClassUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> ClassSummary:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found.")

        validate_class_relationships(db, payload.teacher_id, payload.student_ids)
        classroom.title = payload.title.strip()
        classroom.teacher_id = payload.teacher_id
        classroom.status = payload.status

        existing_enrollments = db.scalars(
            select(Enrollment).where(Enrollment.class_id == class_id)
        ).all()

        for enrollment in existing_enrollments:
            db.delete(enrollment)

        db.flush()

        for student_id in payload.student_ids:
            db.add(Enrollment(class_id=class_id, student_id=student_id))

        db.commit()
        classroom = get_class(db, class_id)

        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found.")

        return build_class_summary(db, classroom)


@api_router.delete("/admin/classes/{class_id}", response_model=SuccessResponse)
def delete_admin_class(
    class_id: str,
    current_user: User = Depends(get_current_user),
) -> SuccessResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            raise HTTPException(status_code=404, detail="Class not found.")

        for recording in classroom.recordings:
            delete_recording_file(recording.file_path)

        db.delete(classroom)
        db.commit()
        return SuccessResponse(success=True, message="Class deleted successfully.")


@api_router.get("/admin/live-sessions", response_model=list[LiveSessionSummary])
def get_admin_live_sessions(
    current_user: User = Depends(get_current_user),
) -> list[LiveSessionSummary]:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        live_sessions = db.scalars(
            select(LiveSession)
            .where(LiveSession.status == "live")
            .order_by(LiveSession.started_at.desc())
        ).all()
        return [build_live_session_summary(db, session) for session in live_sessions]


@api_router.get("/admin/analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics(
    current_user: User = Depends(get_current_user),
) -> AdminAnalyticsResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    with SessionLocal() as db:
        return build_admin_analytics(db)


@api_router.post("/admin/live-sessions/{class_id}/end", response_model=SuccessResponse)
def end_admin_live_session(
    class_id: str,
    current_user: User = Depends(get_current_user),
) -> SuccessResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required.")

    session = mark_class_as_ended(class_id)

    if not session or session.status != "ended":
        raise HTTPException(status_code=404, detail="Live session not found.")

    return SuccessResponse(success=True, message="Live session ended successfully.")


@api_router.get("/teacher/analytics", response_model=TeacherAnalyticsResponse)
def get_teacher_analytics(
    current_user: User = Depends(get_current_user),
) -> TeacherAnalyticsResponse:
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access is required.")

    with SessionLocal() as db:
        teacher = get_teacher_by_email(db, current_user.email)

        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found.")

        return build_teacher_analytics(db, teacher)
