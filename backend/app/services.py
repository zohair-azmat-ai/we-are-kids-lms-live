from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import cast
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import SessionLocal
from app.models import Attendance, BillingAccount, Classroom, Enrollment, LiveSession, Recording, SessionSummary, User
from app.schemas import (
    AttendanceRecord,
    AttendanceSummary,
    SessionSummaryResponse,
    BillingPlan,
    BillingPlanFeatures,
    BillingPlanInfo,
    BillingSubscription,
    BillingUsageMetric,
    BillingUsageSummary,
    ActivityPoint,
    AdminAnalyticsResponse,
    ClassSummary,
    LiveClass,
    LiveSessionSummary,
    RecordingItem,
    StudentSummary,
    TeacherAnalyticsResponse,
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
            "Agora RTC live classroom sessions",
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


def utc_now_naive() -> datetime:
    """Return the current UTC time without tzinfo.

    SQLite strips timezone info from DateTime columns on read, so comparing a
    timezone-aware datetime against a DB-returned naive datetime raises a
    TypeError.  Use this function when comparing against values retrieved from
    the database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def delete_recording_file(recording_file_path: str) -> None:
    file_path = Path(recording_file_path)

    if file_path.exists():
        file_path.unlink()


_NO_FILE_PATHS = {"pending", "no-file", "browser-recorded"}


def build_recording_file_url(recording: Recording) -> str:
    if recording.file_path in _NO_FILE_PATHS:
        return ""
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


# ── In-memory Google Meet link store ──────────────────────────────────────────
import base64 as _base64
import hashlib as _hashlib
import hmac as _hmac
import secrets as _secrets
import struct as _struct
import time as _time
from zlib import crc32 as _crc32


def _pack_uint16(x: int) -> bytes:
    return _struct.pack("<H", x)


def _pack_uint32(x: int) -> bytes:
    return _struct.pack("<I", x)


def _pack_string(s: bytes) -> bytes:
    return _pack_uint16(len(s)) + s


def _pack_map_uint32(m: dict) -> bytes:
    result = _pack_uint16(len(m))
    for k in sorted(m):
        result += _pack_uint16(k) + _pack_uint32(m[k])
    return result


def generate_agora_rtc_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int,
    expire_seconds: int = 3600,
) -> str:
    uid_str = str(uid)
    ts = int(_time.time())
    salt = _secrets.randbelow(100_000) + 1
    expire_ts = ts + expire_seconds
    privileges = {1: expire_ts, 2: expire_ts, 3: expire_ts, 4: expire_ts}
    content = _pack_uint32(ts) + _pack_uint32(salt) + _pack_map_uint32(privileges)
    val = app_id.encode() + channel_name.encode() + uid_str.encode() + content
    sig = _hmac.new(app_certificate.encode(), val, _hashlib.sha256).digest()
    crc_ch = _crc32(channel_name.encode()) & 0xFFFF_FFFF
    crc_uid = _crc32(uid_str.encode()) & 0xFFFF_FFFF
    token_content = _pack_string(sig) + _pack_uint32(crc_ch) + _pack_uint32(crc_uid) + _pack_string(content)
    return "006" + app_id + _base64.b64encode(token_content).decode()


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
            select(Recording).where(Recording.expires_at <= utc_now_naive())
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
        cloud_url=recording.cloud_url or "",
        expires_at=recording.expires_at,
        status=recording.status,
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


def build_recent_activity_points(
    source_dates: list[datetime | None],
    *,
    days: int = 7,
) -> list[ActivityPoint]:
    today = utc_now().date()
    counts: dict[str, int] = {}

    for offset in range(days - 1, -1, -1):
        label = (today - timedelta(days=offset)).strftime("%a")
        counts[label] = 0

    for item in source_dates:
        if not item:
            continue

        item_date = item.date()
        delta = (today - item_date).days

        if 0 <= delta < days:
            label = item_date.strftime("%a")
            counts[label] = counts.get(label, 0) + 1

    return [ActivityPoint(label=label, value=value) for label, value in counts.items()]


def build_admin_analytics(db: Session) -> AdminAnalyticsResponse:
    account = get_or_create_billing_account(db)
    plan_usage_summary = build_billing_usage_summary(db, account)
    teachers = db.scalars(select(User).where(User.role == "teacher")).all()
    students = db.scalars(select(User).where(User.role == "student")).all()
    classes = db.scalars(select(Classroom)).all()
    live_sessions = db.scalars(select(LiveSession)).all()
    recordings = db.scalars(select(Recording)).all()

    active_classes = len([classroom for classroom in classes if classroom.status == "active"])
    active_students = len([student for student in students if student.status == "active"])
    live_sessions_count = len([session for session in live_sessions if session.status == "live"])

    class_sizes = [
        len(db.scalars(select(Enrollment.student_id).where(Enrollment.class_id == classroom.id)).all())
        for classroom in classes
    ]
    full_threshold = 8
    filled_classes = len([size for size in class_sizes if size >= full_threshold])
    class_fill_ratio = 0 if not classes else round((filled_classes / len(classes)) * 100)

    recent_live_sessions = [session.started_at for session in live_sessions]
    recent_recordings = [recording.created_at for recording in recordings]
    recent_live_points = build_recent_activity_points(recent_live_sessions)
    recent_recording_points = build_recent_activity_points(recent_recordings)

    change_total = sum(point.value for point in recent_live_points[-3:]) + sum(
        point.value for point in recent_recording_points[-3:]
    )
    activity_change_label = (
        "Activity is trending up this week."
        if change_total >= 3
        else "Activity is steady. Encourage more live sessions for a stronger demo."
    )

    return AdminAnalyticsResponse(
        total_users=len(teachers) + len(students) + len(db.scalars(select(User).where(User.role == "admin")).all()),
        total_teachers=len(teachers),
        total_students=len(students),
        active_classes=active_classes,
        live_sessions_count=live_sessions_count,
        recordings_count=len(recordings),
        active_students=active_students,
        activity_change_label=activity_change_label,
        class_fill_ratio=class_fill_ratio,
        plan_usage_summary=plan_usage_summary,
        live_activity_points=recent_live_points,
        recording_activity_points=recent_recording_points,
    )


def build_teacher_analytics(db: Session, teacher: User) -> TeacherAnalyticsResponse:
    classes = db.scalars(
        select(Classroom).where(Classroom.teacher_id == teacher.id).order_by(Classroom.title.asc())
    ).all()
    live_sessions = db.scalars(
        select(LiveSession).where(LiveSession.teacher_id == teacher.id).order_by(LiveSession.started_at.desc())
    ).all()
    recordings = db.scalars(
        select(Recording).where(Recording.teacher_id == teacher.id).order_by(Recording.created_at.desc())
    ).all()

    class_ids = [classroom.id for classroom in classes]
    enrollments = db.scalars(
        select(Enrollment).where(Enrollment.class_id.in_(class_ids))
    ).all() if class_ids else []
    student_ids = list({enrollment.student_id for enrollment in enrollments})
    students = db.scalars(
        select(User).where(User.id.in_(student_ids))
    ).all() if student_ids else []
    active_students = len([student for student in students if student.status == "active"])
    average_class_size = 0 if not classes else round(len(enrollments) / len(classes))
    participation_summary = (
        f"{active_students} active learners across {len(classes)} assigned classes."
        if classes
        else "No classes assigned yet. Add a class to begin tracking participation."
    )

    return TeacherAnalyticsResponse(
        assigned_classes=len(classes),
        live_sessions_run=len(live_sessions),
        recordings_created=len(recordings),
        enrolled_students=len(student_ids),
        active_students=active_students,
        average_class_size=average_class_size,
        participation_summary=participation_summary,
        live_activity_points=build_recent_activity_points([session.started_at for session in live_sessions]),
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


# ---------------------------------------------------------------------------
# Attendance service functions
# ---------------------------------------------------------------------------


def record_attendance_join(
    db: Session,
    *,
    session_id: str,
    class_id: str,
    student_id: str,
) -> None:
    """Create or reset an attendance record when a student joins a live session."""
    existing = db.scalar(
        select(Attendance).where(
            Attendance.session_id == session_id,
            Attendance.student_id == student_id,
        )
    )

    if existing:
        existing.status = "present"
        existing.left_at = None
        existing.duration_minutes = None
    else:
        db.add(
            Attendance(
                session_id=session_id,
                class_id=class_id,
                student_id=student_id,
                joined_at=utc_now(),
                status="present",
            )
        )

    db.commit()


def close_attendance_record(
    db: Session,
    *,
    class_id: str,
    student_id: str,
) -> None:
    """Update the open attendance record when a student leaves."""
    latest_session = get_latest_session_for_class(db, class_id)

    if not latest_session:
        return

    record = db.scalar(
        select(Attendance).where(
            Attendance.session_id == latest_session.id,
            Attendance.student_id == student_id,
            Attendance.status == "present",
        )
    )

    if not record:
        return

    now = utc_now()
    record.left_at = now
    record.status = "left"
    duration_seconds = (now - record.joined_at).total_seconds()
    record.duration_minutes = max(1, round(duration_seconds / 60))
    db.commit()


def build_attendance_record(record: Attendance, class_title: str) -> AttendanceRecord:
    return AttendanceRecord(
        id=record.id,
        session_id=record.session_id,
        class_id=record.class_id,
        class_title=class_title,
        student_id=record.student_id,
        student_name=record.student.name,
        student_email=record.student.email,
        joined_at=record.joined_at,
        left_at=record.left_at,
        status=record.status,
        duration_minutes=record.duration_minutes,
    )


def get_session_attendance(db: Session, session_id: str) -> AttendanceSummary | None:
    session = db.scalar(select(LiveSession).where(LiveSession.id == session_id))

    if not session:
        return None

    classroom = get_class(db, session.class_id)

    if not classroom:
        return None

    records = db.scalars(
        select(Attendance)
        .options(selectinload(Attendance.student))
        .where(Attendance.session_id == session_id)
        .order_by(Attendance.joined_at.asc())
    ).all()

    class_title = classroom.title
    attendance_records = [build_attendance_record(r, class_title) for r in records]

    return AttendanceSummary(
        session_id=session_id,
        class_id=session.class_id,
        class_title=class_title,
        session_status=session.status,
        started_at=session.started_at,
        total_attended=len(attendance_records),
        currently_present=sum(1 for r in attendance_records if r.status == "present"),
        records=attendance_records,
    )


def get_class_attendance(db: Session, class_id: str) -> list[AttendanceSummary]:
    sessions = db.scalars(
        select(LiveSession)
        .where(LiveSession.class_id == class_id)
        .order_by(LiveSession.started_at.desc())
    ).all()

    summaries = []

    for session in sessions:
        summary = get_session_attendance(db, session.id)

        if summary:
            summaries.append(summary)

    return summaries


def get_teacher_attendance(db: Session, teacher: User) -> list[AttendanceSummary]:
    """Return attendance summaries for all sessions run by this teacher."""
    sessions = db.scalars(
        select(LiveSession)
        .where(LiveSession.teacher_id == teacher.id)
        .order_by(LiveSession.started_at.desc())
    ).all()

    summaries = []

    for session in sessions:
        summary = get_session_attendance(db, session.id)

        if summary:
            summaries.append(summary)

    return summaries


# ---------------------------------------------------------------------------
# Session summary service functions
# ---------------------------------------------------------------------------


def build_session_summary_response(
    record: SessionSummary,
    class_title: str,
    teacher_name: str,
    total_attended: int,
    started_at: object,
) -> SessionSummaryResponse:
    import json as _json

    try:
        key_points = _json.loads(record.key_points)
    except Exception:
        key_points = [record.key_points] if record.key_points else []

    try:
        action_items = _json.loads(record.action_items)
    except Exception:
        action_items = [record.action_items] if record.action_items else []

    return SessionSummaryResponse(
        id=record.id,
        session_id=record.session_id,
        class_id=record.class_id,
        class_title=class_title,
        teacher_name=teacher_name,
        summary_text=record.summary_text,
        key_points=key_points,
        action_items=action_items,
        generated_at=record.generated_at,
        source_type=record.source_type,
        total_attended=total_attended,
        started_at=started_at,
    )


def get_session_summary_db(db: Session, session_id: str) -> SessionSummaryResponse | None:
    record = db.scalar(
        select(SessionSummary).where(SessionSummary.session_id == session_id)
    )

    if not record:
        return None

    session = db.scalar(select(LiveSession).where(LiveSession.id == session_id))
    classroom = get_class(db, record.class_id) if record else None

    if not session or not classroom:
        return None

    teacher = db.scalar(select(User).where(User.id == record.teacher_id))
    teacher_name = teacher.name if teacher else "Teacher"
    attendance_count = db.scalar(
        select(Attendance).where(Attendance.session_id == session_id).with_only_columns(
            __import__("sqlalchemy", fromlist=["func"]).func.count()
        )
    ) or 0

    return build_session_summary_response(
        record,
        class_title=classroom.title,
        teacher_name=teacher_name,
        total_attended=attendance_count,
        started_at=session.started_at,
    )


def get_class_summaries_db(db: Session, class_id: str) -> list[SessionSummaryResponse]:
    records = db.scalars(
        select(SessionSummary)
        .where(SessionSummary.class_id == class_id)
        .order_by(SessionSummary.generated_at.desc())
    ).all()

    results = []

    for record in records:
        response = get_session_summary_db(db, record.session_id)
        if response:
            results.append(response)

    return results


def generate_and_save_summary(db: Session, session_id: str) -> SessionSummaryResponse | None:
    """Generate and persist a summary for the given session. Safe to call multiple times."""
    import json as _json
    from app.ai_service import generate_session_summary as ai_generate

    session = db.scalar(select(LiveSession).where(LiveSession.id == session_id))

    if not session:
        return None

    classroom = get_class(db, session.class_id)

    if not classroom or not classroom.teacher:
        return None

    teacher = classroom.teacher
    total_attended = db.scalar(
        select(Attendance)
        .where(Attendance.session_id == session_id)
        .with_only_columns(__import__("sqlalchemy", fromlist=["func"]).func.count())
    ) or 0

    started_at = session.started_at
    ended_at = session.ended_at or utc_now()
    duration_minutes = max(0, round((ended_at - started_at).total_seconds() / 60)) if started_at else 0
    started_at_str = started_at.strftime("%A, %d %B %Y at %H:%M UTC") if started_at else "Unknown"

    result = ai_generate(
        class_title=classroom.title,
        teacher_name=teacher.name,
        total_attended=total_attended,
        duration_minutes=duration_minutes,
        started_at=started_at_str,
    )

    existing = db.scalar(select(SessionSummary).where(SessionSummary.session_id == session_id))

    if existing:
        existing.summary_text = result["summary_text"]
        existing.key_points = _json.dumps(result["key_points"])
        existing.action_items = _json.dumps(result["action_items"])
        existing.source_type = result["source_type"]
        existing.generated_at = utc_now()
        db.commit()
        db.refresh(existing)
        record = existing
    else:
        record = SessionSummary(
            session_id=session_id,
            class_id=session.class_id,
            teacher_id=teacher.id,
            summary_text=result["summary_text"],
            key_points=_json.dumps(result["key_points"]),
            action_items=_json.dumps(result["action_items"]),
            generated_at=utc_now(),
            source_type=result["source_type"],
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    return build_session_summary_response(
        record,
        class_title=classroom.title,
        teacher_name=teacher.name,
        total_attended=total_attended,
        started_at=started_at,
    )


def trigger_session_summary_background(class_id: str) -> None:
    """Background task — generates summary after session ends. Swallows all errors."""
    try:
        with SessionLocal() as db:
            session = get_latest_session_for_class(db, class_id)
            if session and session.status == "ended":
                generate_and_save_summary(db, session.id)
    except Exception:
        pass
