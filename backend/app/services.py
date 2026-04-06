from datetime import datetime, timezone
from pathlib import Path
from typing import cast
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import SessionLocal
from app.models import BillingAccount, Classroom, Enrollment, LiveSession, Recording, User
from app.schemas import (
    BillingPlan,
    BillingPlanFeatures,
    BillingPlanInfo,
    BillingSubscription,
    BillingUsageMetric,
    BillingUsageSummary,
    ClassSummary,
    LiveClass,
    LiveSessionSummary,
    RecordingItem,
    StudentSummary,
    TeacherSummary,
)


PLAN_FEATURES: dict[BillingPlan, dict[str, object]] = {
    "starter": {
        "name": "Starter",
        "description": "For a small school getting its digital classrooms online.",
        "teachers_limit": 2,
        "students_limit": 10,
        "classes_limit": 3,
        "recordings_access": "basic",
        "priority_features": False,
        "monthly_label": "Entry plan",
        "audience": "Small school",
        "highlights": [
            "Core nursery LMS dashboard",
            "LiveKit classroom sessions",
            "Basic recordings access",
        ],
    },
    "standard": {
        "name": "Standard",
        "description": "For growing schools that need more teachers, classes, and students.",
        "teachers_limit": 10,
        "students_limit": 100,
        "classes_limit": 20,
        "recordings_access": "full",
        "priority_features": False,
        "monthly_label": "Growth plan",
        "audience": "Growing school",
        "highlights": [
            "Higher classroom and enrollment capacity",
            "Full recordings access",
            "Better room for expanding teams",
        ],
    },
    "premium": {
        "name": "Premium",
        "description": "For advanced usage across larger school operations.",
        "teachers_limit": None,
        "students_limit": None,
        "classes_limit": None,
        "recordings_access": "full",
        "priority_features": True,
        "monthly_label": "Advanced plan",
        "audience": "Advanced usage",
        "highlights": [
            "Unlimited core capacity",
            "Priority-ready features enabled",
            "Best fit for multi-team operations",
        ],
    },
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def delete_recording_file(recording_file_path: str) -> None:
    file_path = Path(recording_file_path)

    if file_path.exists():
        file_path.unlink()


def build_recording_file_url(recording: Recording) -> str:
    return f"/uploads/recordings/{Path(recording.file_path).name}"


def get_teacher(db: Session, teacher_id: str) -> User | None:
    return db.scalar(select(User).where(User.id == teacher_id, User.role == "teacher"))


def get_student(db: Session, student_id: str) -> User | None:
    return db.scalar(select(User).where(User.id == student_id, User.role == "student"))


def get_teacher_by_email(db: Session, email: str) -> User | None:
    return db.scalar(
        select(User).where(
            User.email == normalize_email(email),
            User.role == "teacher",
        )
    )


def get_user_by_email_and_role(db: Session, email: str, role: str) -> User | None:
    return db.scalar(
        select(User).where(
            User.email == normalize_email(email),
            User.role == role,
        )
    )


def get_user_by_name_and_role(db: Session, name: str, role: str) -> User | None:
    return db.scalar(
        select(User).where(
            User.name == name.strip(),
            User.role == role,
        )
    )


def get_class(db: Session, class_id: str) -> Classroom | None:
    return db.scalar(
        select(Classroom)
        .options(
            selectinload(Classroom.teacher),
            selectinload(Classroom.enrollments),
            selectinload(Classroom.recordings),
        )
        .where(Classroom.id == class_id)
    )


def get_active_session_for_class(db: Session, class_id: str) -> LiveSession | None:
    return db.scalar(
        select(LiveSession).where(
            LiveSession.class_id == class_id,
            LiveSession.status == "live",
        )
    )


def get_latest_session_for_class(db: Session, class_id: str) -> LiveSession | None:
    return db.scalar(
        select(LiveSession)
        .where(LiveSession.class_id == class_id)
        .order_by(LiveSession.started_at.desc(), LiveSession.id.desc())
    )


def get_or_create_live_session(db: Session, classroom: Classroom, teacher: User) -> LiveSession:
    existing_session = get_active_session_for_class(db, classroom.id)

    if existing_session:
        return existing_session

    return create_live_session(db, classroom, teacher)


def is_student_enrolled_in_class(db: Session, class_id: str, student_id: str) -> bool:
    enrollment = db.scalar(
        select(Enrollment).where(
            Enrollment.class_id == class_id,
            Enrollment.student_id == student_id,
        )
    )
    return enrollment is not None


def build_live_class_response(classroom: Classroom, session: LiveSession | None) -> LiveClass:
    if not classroom.teacher:
        raise HTTPException(status_code=404, detail="Teacher not found for class.")

    if session:
        return LiveClass(
            class_id=classroom.id,
            teacher_name=classroom.teacher.name,
            teacher_email=classroom.teacher.email,
            title=classroom.title,
            status=session.status,
            participants_count=session.participants_count,
            started_at=session.started_at,
        )

    return LiveClass(
        class_id=classroom.id,
        teacher_name=classroom.teacher.name,
        teacher_email=classroom.teacher.email,
        title=classroom.title,
        status="scheduled",
        participants_count=0,
        started_at=None,
    )


def get_live_or_scheduled_class(class_id: str) -> LiveClass | None:
    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            return None

        session = get_active_session_for_class(db, class_id)

        if session:
            return build_live_class_response(classroom, session)

        latest_session = get_latest_session_for_class(db, class_id)

        if latest_session and latest_session.status == "ended":
            return build_live_class_response(classroom, latest_session)

        return build_live_class_response(classroom, None)


def set_class_participants_count(class_id: str, participants_count: int) -> LiveClass | None:
    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            return None

        session = get_active_session_for_class(db, class_id)

        if not session:
            latest_session = get_latest_session_for_class(db, class_id)

            if latest_session and latest_session.status == "ended":
                return build_live_class_response(classroom, latest_session)

            return build_live_class_response(classroom, None)

        session.participants_count = participants_count
        db.commit()
        db.refresh(session)
        return build_live_class_response(classroom, session)


def update_live_session_presence(class_id: str, delta: int) -> LiveClass | None:
    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            return None

        session = get_active_session_for_class(db, class_id)

        if not session:
            latest_session = get_latest_session_for_class(db, class_id)

            if latest_session and latest_session.status == "ended":
                return build_live_class_response(classroom, latest_session)

            return build_live_class_response(classroom, None)

        session.participants_count = max(0, session.participants_count + delta)
        db.commit()
        db.refresh(session)
        return build_live_class_response(classroom, session)


def mark_class_as_ended(class_id: str) -> LiveClass | None:
    with SessionLocal() as db:
        classroom = get_class(db, class_id)

        if not classroom:
            return None

        session = get_active_session_for_class(db, class_id)

        if session:
            session.status = "ended"
            session.participants_count = 0
            session.ended_at = utc_now()
            db.commit()
            db.refresh(session)
            return build_live_class_response(classroom, session)

        latest_session = get_latest_session_for_class(db, class_id)

        if latest_session:
            latest_session.status = "ended"
            latest_session.participants_count = 0
            latest_session.ended_at = latest_session.ended_at or utc_now()
            db.commit()
            db.refresh(latest_session)
            return build_live_class_response(classroom, latest_session)

        return build_live_class_response(classroom, None)


def cleanup_expired_recordings() -> None:
    with SessionLocal() as db:
        expired_recordings = db.scalars(
            select(Recording).where(Recording.expires_at <= utc_now())
        ).all()

        for recording in expired_recordings:
            delete_recording_file(recording.file_path)
            db.delete(recording)

        db.commit()


def serialize_recording(recording: Recording, teacher: User | None = None) -> RecordingItem:
    teacher_name = teacher.name if teacher else (recording.teacher.name if recording.teacher else "Teacher")
    return RecordingItem(
        recording_id=recording.id,
        class_id=recording.class_id,
        title=recording.title,
        teacher=teacher_name,
        created_at=recording.created_at,
        file_path=recording.file_path,
        file_url=build_recording_file_url(recording),
        expires_at=recording.expires_at,
    )


def validate_unique_user_email(
    db: Session,
    email: str,
    role: str,
    exclude_user_id: str | None = None,
) -> None:
    existing_user = db.scalar(
        select(User).where(User.email == normalize_email(email), User.role == role)
    )

    if existing_user and existing_user.id != exclude_user_id:
        raise HTTPException(status_code=400, detail=f"{role.title()} email already exists.")


def validate_class_relationships(db: Session, teacher_id: str, student_ids: list[str]) -> None:
    if not get_teacher(db, teacher_id):
        raise HTTPException(status_code=404, detail="Teacher not found.")

    for student_id in student_ids:
        if not get_student(db, student_id):
            raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")


def build_teacher_summary(db: Session, teacher: User) -> TeacherSummary:
    assigned_classes_count = len(
        db.scalars(select(Classroom.id).where(Classroom.teacher_id == teacher.id)).all()
    )
    return TeacherSummary(
        teacher_id=teacher.id,
        name=teacher.name,
        email=teacher.email,
        assigned_classes_count=assigned_classes_count,
        status=teacher.status,
    )


def build_student_summary(db: Session, student: User) -> StudentSummary:
    enrolled_classes_count = len(
        db.scalars(select(Enrollment.id).where(Enrollment.student_id == student.id)).all()
    )
    return StudentSummary(
        student_id=student.id,
        name=student.name,
        email=student.email,
        enrolled_classes_count=enrolled_classes_count,
        status=student.status,
    )


def build_class_summary(db: Session, classroom: Classroom) -> ClassSummary:
    active_session = get_active_session_for_class(db, classroom.id)
    latest_session = get_latest_session_for_class(db, classroom.id)

    if active_session:
        live_status = "live"
    elif latest_session and latest_session.status == "ended":
        live_status = "ended"
    else:
        live_status = "scheduled"

    student_ids = [enrollment.student_id for enrollment in classroom.enrollments]

    return ClassSummary(
        class_id=classroom.id,
        title=classroom.title,
        teacher_id=classroom.teacher_id,
        teacher_name=classroom.teacher.name if classroom.teacher else "Unassigned",
        student_ids=student_ids,
        enrolled_students_count=len(student_ids),
        status=classroom.status,
        live_status=live_status,
    )


def build_live_session_summary(db: Session, session: LiveSession) -> LiveSessionSummary:
    classroom = get_class(db, session.class_id)

    if not classroom or not classroom.teacher:
        raise HTTPException(status_code=404, detail="Class session not found.")

    return LiveSessionSummary(
        class_id=classroom.id,
        title=classroom.title,
        teacher_name=classroom.teacher.name,
        participants_count=session.participants_count,
        start_time=session.started_at,
        status=session.status,
    )


def create_live_session(db: Session, classroom: Classroom, teacher: User) -> LiveSession:
    session = LiveSession(
        id=uuid4().hex,
        class_id=classroom.id,
        teacher_id=teacher.id,
        status="live",
        participants_count=0,
        started_at=utc_now(),
        ended_at=None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_or_create_billing_account(db: Session) -> BillingAccount:
    account = db.scalar(select(BillingAccount).limit(1))

    if account:
        return account

    admin_user = db.scalar(
        select(User).where(User.role == "admin").order_by(User.created_at.asc())
    )

    account = BillingAccount(
        id="school-account-1",
        school_name="We Are Kids Nursery",
        billing_email=admin_user.email if admin_user else "admin@wearekids.com",
        plan="starter",
        subscription_status="inactive",
        current_period_end=None,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_billing_account_by_customer_id(db: Session, customer_id: str) -> BillingAccount | None:
    return db.scalar(
        select(BillingAccount).where(BillingAccount.stripe_customer_id == customer_id)
    )


def get_billing_account_by_subscription_id(
    db: Session,
    subscription_id: str,
) -> BillingAccount | None:
    return db.scalar(
        select(BillingAccount).where(BillingAccount.stripe_subscription_id == subscription_id)
    )


def get_plan_features(plan: BillingPlan) -> BillingPlanFeatures:
    plan_config = PLAN_FEATURES[plan]
    return BillingPlanFeatures(
        teachers_limit=cast(int | None, plan_config["teachers_limit"]),
        students_limit=cast(int | None, plan_config["students_limit"]),
        classes_limit=cast(int | None, plan_config["classes_limit"]),
        recordings_access=cast(str, plan_config["recordings_access"]),
        priority_features=bool(plan_config["priority_features"]),
        monthly_label=str(plan_config["monthly_label"]),
        audience=str(plan_config["audience"]),
        highlights=[str(item) for item in plan_config["highlights"]],
    )


def build_plan_catalog(current_plan: BillingPlan) -> list[BillingPlanInfo]:
    plans: list[BillingPlanInfo] = []

    for code in ("starter", "standard", "premium"):
        typed_code = cast(BillingPlan, code)
        plan_config = PLAN_FEATURES[typed_code]
        plans.append(
            BillingPlanInfo(
                code=typed_code,
                name=str(plan_config["name"]),
                description=str(plan_config["description"]),
                is_current=typed_code == current_plan,
                features=get_plan_features(typed_code),
            )
        )

    return plans


def get_current_usage(db: Session) -> dict[str, int]:
    teachers_count = len(db.scalars(select(User.id).where(User.role == "teacher")).all())
    students_count = len(db.scalars(select(User.id).where(User.role == "student")).all())
    classes_count = len(db.scalars(select(Classroom.id)).all())
    return {
        "teachers_count": teachers_count,
        "students_count": students_count,
        "classes_count": classes_count,
    }


def build_usage_metric(current: int, limit: int | None, label: str) -> BillingUsageMetric:
    is_unlimited = limit is None
    remaining = None if is_unlimited else max(0, limit - current)
    percent_used = 0 if is_unlimited or limit == 0 else min(100, round((current / limit) * 100))
    is_at_limit = False if is_unlimited else current >= limit
    is_near_limit = False if is_unlimited else current >= max(1, int(limit * 0.8))
    upgrade_message = None

    if is_at_limit:
        upgrade_message = f"Upgrade your plan to add more {label.lower()}."
    elif is_near_limit:
        upgrade_message = f"You are close to your {label.lower()} limit."

    return BillingUsageMetric(
        current=current,
        limit=limit,
        remaining=remaining,
        is_unlimited=is_unlimited,
        percent_used=percent_used,
        is_near_limit=is_near_limit,
        is_at_limit=is_at_limit,
        upgrade_message=upgrade_message,
    )


def build_billing_usage_summary(db: Session, account: BillingAccount) -> BillingUsageSummary:
    usage = get_current_usage(db)
    current_plan = cast(BillingPlan, account.plan if account.plan in PLAN_FEATURES else "starter")
    features = get_plan_features(current_plan)

    teachers_metric = build_usage_metric(
        usage["teachers_count"], features.teachers_limit, "Teachers"
    )
    students_metric = build_usage_metric(
        usage["students_count"], features.students_limit, "Students"
    )
    classes_metric = build_usage_metric(
        usage["classes_count"], features.classes_limit, "Classes"
    )

    warnings: list[str] = []

    if teachers_metric.is_at_limit:
        warnings.append(
            f"{PLAN_FEATURES[current_plan]['name']} plan allows up to {features.teachers_limit} teachers."
        )
    elif teachers_metric.is_near_limit and not teachers_metric.is_unlimited:
        warnings.append("You are close to your teacher limit.")

    if students_metric.is_at_limit:
        warnings.append(
            f"{PLAN_FEATURES[current_plan]['name']} plan allows up to {features.students_limit} students."
        )
    elif students_metric.is_near_limit and not students_metric.is_unlimited:
        warnings.append("You are close to your student limit.")

    if classes_metric.is_at_limit:
        warnings.append(
            f"{PLAN_FEATURES[current_plan]['name']} plan allows up to {features.classes_limit} classes."
        )
    elif classes_metric.is_near_limit and not classes_metric.is_unlimited:
        warnings.append("You are close to your class limit.")

    if current_plan != "premium":
        warnings.append("Upgrade to Premium for unlimited core capacity and priority-ready features.")

    return BillingUsageSummary(
        plan=current_plan,
        subscription_status=account.subscription_status,
        teacher_count=usage["teachers_count"],
        teacher_limit=features.teachers_limit,
        student_count=usage["students_count"],
        student_limit=features.students_limit,
        class_count=usage["classes_count"],
        class_limit=features.classes_limit,
        teachers=teachers_metric,
        students=students_metric,
        classes=classes_metric,
        recordings_access=features.recordings_access,
        priority_features=features.priority_features,
        warnings=warnings,
    )


def build_billing_subscription(db: Session, account: BillingAccount) -> BillingSubscription:
    usage = get_current_usage(db)
    current_plan = account.plan if account.plan in PLAN_FEATURES else "starter"
    return BillingSubscription(
        school_name=account.school_name,
        billing_email=account.billing_email,
        plan=current_plan,
        subscription_status=account.subscription_status,
        current_period_end=account.current_period_end,
        stripe_customer_id=account.stripe_customer_id,
        stripe_subscription_id=account.stripe_subscription_id,
        plans=build_plan_catalog(current_plan),
        teachers_count=usage["teachers_count"],
        students_count=usage["students_count"],
        classes_count=usage["classes_count"],
    )


def require_admin_user(db: Session, admin_email: str) -> User:
    admin_user = get_user_by_email_and_role(db, admin_email, "admin")

    if not admin_user:
        raise HTTPException(status_code=403, detail="Admin access is required for billing.")

    return admin_user


def require_plan_capacity(db: Session, resource_type: str) -> None:
    account = get_or_create_billing_account(db)
    current_plan = cast(BillingPlan, account.plan if account.plan in PLAN_FEATURES else "starter")
    features = get_plan_features(current_plan)
    usage = get_current_usage(db)

    limit_key = f"{resource_type}_limit"
    count_key = f"{resource_type}_count"
    limit_value = getattr(features, limit_key)
    current_value = usage[count_key]

    if limit_value is None:
        return

    if current_value >= limit_value:
        plan_name = PLAN_FEATURES[current_plan]["name"]
        singular_resource = resource_type[:-1]
        raise HTTPException(
            status_code=403,
            detail=(
                f"{plan_name} plan allows up to {limit_value} {resource_type}. "
                f"Upgrade your plan to add more {singular_resource}s."
            ),
        )


def update_billing_account_from_subscription(
    account: BillingAccount,
    *,
    customer_id: str | None,
    subscription_id: str | None,
    plan: str | None,
    status: str | None,
    current_period_end: datetime | None,
) -> None:
    if customer_id:
        account.stripe_customer_id = customer_id

    if subscription_id is not None:
        account.stripe_subscription_id = subscription_id

    if plan in PLAN_FEATURES:
        account.plan = plan

    if status:
        account.subscription_status = status

    account.current_period_end = current_period_end
