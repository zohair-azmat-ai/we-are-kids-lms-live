import json
import logging
from datetime import timedelta
from typing import Any
from urllib import error, request

logger = logging.getLogger(__name__)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models import Attendance, Classroom, Enrollment, LiveSession, Recording, User
from app.schemas import AIInsightItem, AIInsightsResponse, AIChatResponse, SessionSummaryResponse
from app.services import (
    build_billing_usage_summary,
    get_or_create_billing_account,
    get_teacher_by_email,
    get_latest_session_for_class,
    utc_now,
)


FULL_CLASS_THRESHOLD = 8
ALERT_PRIORITY = {"critical": 3, "warning": 2, "info": 1}
MAX_ALERT_ITEMS = 3


def _serialize_usage_metric(metric: Any) -> dict[str, Any]:
    return {
        "current": metric.current,
        "limit": metric.limit,
        "remaining": metric.remaining,
        "is_unlimited": metric.is_unlimited,
        "percent_used": metric.percent_used,
        "is_near_limit": metric.is_near_limit,
        "is_at_limit": metric.is_at_limit,
        "upgrade_message": metric.upgrade_message,
    }


def build_ai_snapshot(db: Session, current_user: User) -> dict[str, Any]:
    account = get_or_create_billing_account(db)
    usage = build_billing_usage_summary(db, account)
    now = utc_now()

    if current_user.role == "teacher":
        teacher = get_teacher_by_email(db, current_user.email)

        if not teacher:
            raise ValueError("Teacher account not found.")

        classrooms = db.scalars(
            select(Classroom).where(Classroom.teacher_id == teacher.id).order_by(Classroom.title.asc())
        ).all()
        class_ids = [classroom.id for classroom in classrooms]
        students = db.scalars(
            select(User)
            .distinct()
            .join(Enrollment, Enrollment.student_id == User.id)
            .where(User.role == "student", Enrollment.class_id.in_(class_ids))
        ).all() if class_ids else []
        live_sessions = db.scalars(
            select(LiveSession)
            .where(LiveSession.teacher_id == teacher.id)
            .order_by(LiveSession.started_at.desc())
        ).all()
        recordings = db.scalars(
            select(Recording)
            .where(Recording.teacher_id == teacher.id)
            .order_by(Recording.created_at.desc())
        ).all()
        active_students = len([student for student in students if student.status == "active"])
        inactive_students = len(students) - active_students
        active_teachers = 1 if teacher.status == "active" else 0
        inactive_teachers = 0 if teacher.status == "active" else 1
        school_classes = classrooms
    else:
        classrooms = db.scalars(select(Classroom).order_by(Classroom.title.asc())).all()
        live_sessions = db.scalars(
            select(LiveSession).order_by(LiveSession.started_at.desc())
        ).all()
        recordings = db.scalars(
            select(Recording).order_by(Recording.created_at.desc())
        ).all()
        teachers = db.scalars(select(User).where(User.role == "teacher")).all()
        students = db.scalars(select(User).where(User.role == "student")).all()
        active_students = len([student for student in students if student.status == "active"])
        inactive_students = len(students) - active_students
        active_teachers = len([teacher for teacher in teachers if teacher.status == "active"])
        inactive_teachers = len(teachers) - active_teachers
        school_classes = classrooms

    class_summaries: list[dict[str, Any]] = []

    for classroom in classrooms:
        student_count = len(
            db.scalars(select(Enrollment.student_id).where(Enrollment.class_id == classroom.id)).all()
        )
        latest_session = get_latest_session_for_class(db, classroom.id)
        class_summaries.append(
            {
                "class_id": classroom.id,
                "title": classroom.title,
                "teacher_id": classroom.teacher_id,
                "student_count": student_count,
                "status": classroom.status,
                "live_status": latest_session.status if latest_session else "scheduled",
                "is_full": student_count >= FULL_CLASS_THRESHOLD,
                "last_session_at": latest_session.started_at.isoformat() if latest_session and latest_session.started_at else None,
            }
        )

    recent_session_cutoff = now - timedelta(days=7)
    recent_recording_cutoff = now - timedelta(days=7)
    recent_attendance_cutoff = now - timedelta(days=7)
    recent_live_sessions = [
        session for session in live_sessions if session.started_at and session.started_at >= recent_session_cutoff
    ]
    recent_recordings = [
        recording for recording in recordings if recording.created_at >= recent_recording_cutoff
    ]
    attendance_query = select(Attendance).where(Attendance.joined_at >= recent_attendance_cutoff)
    if classrooms:
        attendance_query = attendance_query.where(Attendance.class_id.in_([classroom.id for classroom in classrooms]))
    else:
        attendance_query = attendance_query.where(Attendance.class_id == "__none__")
    recent_attendance = db.scalars(attendance_query).all()
    sessions_with_attendance = {record.session_id for record in recent_attendance}
    avg_attendance_per_session = (
        round(len(recent_attendance) / len(sessions_with_attendance), 1)
        if sessions_with_attendance
        else 0.0
    )
    expiring_recordings = [
        recording for recording in recordings if recording.expires_at <= now + timedelta(days=2)
    ]

    return {
        "scope": current_user.role,
        "user": {
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
        },
        "plan": usage.plan,
        "subscription_status": usage.subscription_status,
        "usage": {
            "teachers": _serialize_usage_metric(usage.teachers),
            "students": _serialize_usage_metric(usage.students),
            "classes": _serialize_usage_metric(usage.classes),
            "warnings": usage.warnings,
            "recordings_access": usage.recordings_access,
            "priority_features": usage.priority_features,
        },
        "counts": {
            "teachers_total": active_teachers + inactive_teachers,
            "teachers_active": active_teachers,
            "teachers_inactive": inactive_teachers,
            "students_total": active_students + inactive_students,
            "students_active": active_students,
            "students_inactive": inactive_students,
            "classes_total": len(school_classes),
            "live_sessions_total": len([session for session in live_sessions if session.status == "live"]),
            "recordings_total": len(recordings),
            "recordings_expiring_soon": len(expiring_recordings),
        },
        "classes": class_summaries,
        "recent_activity": {
            "recent_live_sessions": len(recent_live_sessions),
            "recent_recordings": len(recent_recordings),
            "attendance_events_last_7_days": len(recent_attendance),
            "sessions_with_attendance_last_7_days": len(sessions_with_attendance),
            "avg_attendance_per_session": avg_attendance_per_session,
        },
        "full_class_threshold": FULL_CLASS_THRESHOLD,
    }


def _build_default_ai_insights(scope: str) -> AIInsightsResponse:
    billing_href = "/admin/billing" if scope == "admin" else "/teacher/dashboard"
    recordings_href = "/admin/recordings" if scope == "admin" else "/teacher/recordings"
    live_href = "/admin/live-sessions" if scope == "admin" else "/teacher/dashboard"
    return AIInsightsResponse(
        generated_at=utc_now(),
        summary="All systems are stable. Schedule a live session or review recordings to keep learners engaged.",
        items=[
            AIInsightItem(
                id="engagement-default",
                alert_type="engagement",
                title="Schedule your next live session",
                message="No live sessions have run recently. Starting a session keeps attendance records fresh and learners on track.",
                severity="warning",
                cta_label="Go to Live Sessions",
                cta_href=live_href,
            ),
            AIInsightItem(
                id="status-default",
                alert_type="status",
                title="Review expiring recordings",
                message="Check your recordings panel to make sure key lessons haven't expired. Families rely on replays between sessions.",
                severity="info",
                cta_label="Open Recordings",
                cta_href=recordings_href,
            ),
            AIInsightItem(
                id="capacity-default",
                alert_type="capacity",
                title="Plan capacity looks healthy",
                message="Enrollment limits are within range. Review your billing dashboard if you expect to add more teachers or students soon.",
                severity="info",
                cta_label="View Billing",
                cta_href=billing_href,
            ),
        ],
    )


def _merge_messages(*parts: str) -> str:
    unique_parts: list[str] = []
    for part in parts:
        cleaned = part.strip()
        if cleaned and cleaned not in unique_parts:
            unique_parts.append(cleaned)
    return " ".join(unique_parts)


def _choose_severity(current: str, candidate: str) -> str:
    return candidate if ALERT_PRIORITY[candidate] > ALERT_PRIORITY[current] else current


def build_ai_insights_from_snapshot(snapshot: dict[str, Any]) -> AIInsightsResponse:
    items_by_type: dict[str, AIInsightItem] = {}
    usage = snapshot["usage"]
    counts = snapshot["counts"]
    classes = snapshot["classes"]
    scope = snapshot["scope"]
    recent_activity = snapshot["recent_activity"]

    def upsert_alert(
        *,
        alert_type: str,
        title: str,
        message: str,
        severity: str,
        cta_label: str | None = None,
        cta_href: str | None = None,
    ) -> None:
        existing = items_by_type.get(alert_type)
        if not existing:
            items_by_type[alert_type] = AIInsightItem(
                id=f"{alert_type}-alert",
                alert_type=alert_type,  # type: ignore[arg-type]
                title=title,
                message=message,
                severity=severity,  # type: ignore[arg-type]
                cta_label=cta_label,
                cta_href=cta_href,
            )
            return

        merged_message = _merge_messages(existing.message, message)
        merged_severity = _choose_severity(existing.severity, severity)
        use_candidate_title = ALERT_PRIORITY[severity] > ALERT_PRIORITY[existing.severity]
        merged_title = title if use_candidate_title else existing.title
        merged_cta_label = cta_label or existing.cta_label
        merged_cta_href = cta_href or existing.cta_href

        items_by_type[alert_type] = AIInsightItem(
            id=existing.id,
            alert_type=existing.alert_type,
            title=merged_title,
            message=merged_message,
            severity=merged_severity,  # type: ignore[arg-type]
            cta_label=merged_cta_label,
            cta_href=merged_cta_href,
        )

    full_classes = [classroom for classroom in classes if classroom["is_full"]]
    at_limit_resources = [
        resource_name
        for resource_name in ("teachers", "students", "classes")
        if usage[resource_name]["is_at_limit"]
    ]
    near_limit_resources = [
        resource_name
        for resource_name in ("teachers", "students", "classes")
        if usage[resource_name]["is_near_limit"] and resource_name not in at_limit_resources
    ]

    # Capacity + upgrade merged into one alert to avoid two critical cards for the same root cause
    if at_limit_resources:
        limit_list = ", ".join(at_limit_resources)
        extra = f" Additionally, {len(full_classes)} class(es) are at the learner threshold." if full_classes else ""
        upsert_alert(
            alert_type="capacity",
            title=f"Plan limit reached for {limit_list}",
            message=(
                f"Enrollment is blocked for {limit_list} — your plan has no remaining slots.{extra} "
                "Upgrade now to unblock enrolment and avoid disrupting teachers or families."
            ),
            severity="critical",
            cta_label="Upgrade Plan",
            cta_href="/pricing",
        )
    elif near_limit_resources:
        near_list = ", ".join(near_limit_resources)
        full_note = f" {len(full_classes)} class(es) are also nearing capacity." if full_classes else ""
        upsert_alert(
            alert_type="capacity",
            title="Approaching plan limits",
            message=(
                f"Usage is close to the ceiling for {near_list}.{full_note} "
                "Consider upgrading before enrolment is blocked."
            ),
            severity="warning",
            cta_label="Review Billing",
            cta_href="/admin/billing" if scope == "admin" else "/pricing",
        )
    elif full_classes:
        upsert_alert(
            alert_type="capacity",
            title=f"{len(full_classes)} class(es) are full",
            message=(
                f"{len(full_classes)} class(es) have reached {snapshot['full_class_threshold']} or more learners. "
                "Adding a new class section will help distribute enrolment."
            ),
            severity="info",
            cta_label="Manage Classes",
            cta_href="/admin/classes" if scope == "admin" else None,
        )

    # Engagement — pick the single most important signal only
    no_sessions = recent_activity["recent_live_sessions"] == 0
    no_attendance = recent_activity["attendance_events_last_7_days"] == 0

    if no_sessions:
        upsert_alert(
            alert_type="engagement",
            title="No live sessions this week",
            message=(
                "No live sessions have been started in the last 7 days. "
                "Scheduling a lesson keeps attendance records active and learners engaged."
            ),
            severity="warning",
            cta_label="Start a Session",
            cta_href="/admin/live-sessions" if scope == "admin" else "/teacher/dashboard",
        )
    elif no_attendance:
        upsert_alert(
            alert_type="engagement",
            title="Attendance data missing",
            message=(
                f"{recent_activity['recent_live_sessions']} session(s) ran this week but no attendance was recorded. "
                "Check that the attendance panel is active during lessons."
            ),
            severity="warning",
            cta_label="Review Sessions",
            cta_href="/admin/live-sessions" if scope == "admin" else "/teacher/dashboard",
        )
    else:
        avg = recent_activity["avg_attendance_per_session"]
        upsert_alert(
            alert_type="engagement",
            title="Weekly activity looks healthy",
            message=(
                f"{recent_activity['recent_live_sessions']} session(s) ran this week "
                f"with an average of {avg} learner(s) per session."
            ),
            severity="info",
            cta_label="View Sessions",
            cta_href="/admin/live-sessions" if scope == "admin" else "/teacher/dashboard",
        )

    # Recordings expiry — only if genuinely urgent
    if counts["recordings_expiring_soon"] > 0:
        upsert_alert(
            alert_type="status",
            title=f"{counts['recordings_expiring_soon']} recording(s) expiring soon",
            message=(
                f"{counts['recordings_expiring_soon']} recording(s) will expire within 2 days. "
                "Review or replace them so families keep replay access."
            ),
            severity="warning",
            cta_label="Open Recordings",
            cta_href="/admin/recordings" if scope == "admin" else "/teacher/recordings",
        )

    if not items_by_type:
        return _build_default_ai_insights(scope)

    sorted_items = sorted(
        items_by_type.values(),
        key=lambda item: ALERT_PRIORITY[item.severity],
        reverse=True,
    )
    top_items = sorted_items[:MAX_ALERT_ITEMS]

    # Build a short, specific summary from the top alert
    top = top_items[0]
    summary = top.title if len(top.title) < 80 else top.message[:120]
    return AIInsightsResponse(generated_at=utc_now(), summary=summary, items=top_items)


def get_default_ai_insights(scope: str) -> AIInsightsResponse:
    return _build_default_ai_insights(scope)


def _build_system_prompt(snapshot: dict[str, Any], insights: AIInsightsResponse) -> str:
    return (
        "You are an AI operations assistant for a nursery LMS SaaS product. "
        "Answer only from the provided database snapshot. Be concise, practical, and friendly. "
        "If the user asks about 'full classes', use the provided full_class_threshold operational rule. "
        "If an upgrade or action is relevant, recommend it clearly. "
        f"Current snapshot: {json.dumps(snapshot, default=str)} "
        f"Current insights: {json.dumps(insights.model_dump(), default=str)}"
    )


def _extract_output_text(payload: dict[str, Any]) -> str:
    output_text = payload.get("output_text")

    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"}:
                text = content.get("text", "").strip()
                if text:
                    return text

    return ""


def _call_openai(question: str, snapshot: dict[str, Any], insights: AIInsightsResponse) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is missing.")

    body = {
        "model": OPENAI_MODEL,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": _build_system_prompt(snapshot, insights),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": question.strip(),
                    }
                ],
            },
        ],
    }

    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        logger.error("OpenAI HTTP error: %s", detail or exc.reason)
        raise RuntimeError(f"OpenAI request failed: {detail or exc.reason}") from exc
    except error.URLError as exc:
        logger.error("OpenAI URL error: %s", exc.reason)
        raise RuntimeError("OpenAI request could not be completed.") from exc
    except TimeoutError as exc:
        logger.error("OpenAI request timed out")
        raise RuntimeError("OpenAI request timed out.") from exc

    answer = _extract_output_text(response_payload)

    if not answer:
        logger.warning("OpenAI returned an empty answer for question: %s", question[:80])
        raise RuntimeError("OpenAI returned an empty answer.")

    return answer


def _fallback_answer(question: str, snapshot: dict[str, Any], insights: AIInsightsResponse) -> tuple[str, list[str]]:
    question_lower = question.strip().lower()
    counts = snapshot["counts"]
    classes = snapshot["classes"]
    usage = snapshot["usage"]
    suggestions: list[str] = []

    if "active student" in question_lower:
        suggestions = ["Review student roster", "Open dashboard insights"]
        return (
            f"There are {counts['students_active']} active students in your current scope and {counts['students_inactive']} inactive students.",
            suggestions,
        )

    if "active teacher" in question_lower:
        suggestions = ["Review teacher accounts", "Check plan usage"]
        return (
            f"There are {counts['teachers_active']} active teachers and {counts['teachers_inactive']} inactive teachers in your current scope.",
            suggestions,
        )

    if "usage" in question_lower or "plan" in question_lower:
        suggestions = ["Open billing", "Review upgrade options"]
        return (
            "Usage summary: "
            f"teachers {usage['teachers']['current']}/{usage['teachers']['limit'] or 'Unlimited'}, "
            f"students {usage['students']['current']}/{usage['students']['limit'] or 'Unlimited'}, "
            f"classes {usage['classes']['current']}/{usage['classes']['limit'] or 'Unlimited'}. "
            f"Plan status is {snapshot['subscription_status']}.",
            suggestions,
        )

    if "full class" in question_lower or "classes are full" in question_lower:
        full_classes = [classroom["title"] for classroom in classes if classroom["is_full"]]
        suggestions = ["Create another class", "Review class assignments"]

        if full_classes:
            return (
                "Using the current nursery threshold of "
                f"{snapshot['full_class_threshold']} learners, these classes look full: "
                f"{', '.join(full_classes)}.",
                suggestions,
            )

        return (
            f"No classes are currently at the operational full threshold of {snapshot['full_class_threshold']} learners.",
            suggestions,
        )

    if "recording" in question_lower:
        suggestions = ["Open recordings", "Review expiring lessons"]
        return (
            f"There are {counts['recordings_total']} recordings available and {counts['recordings_expiring_soon']} expiring within 2 days.",
            suggestions,
        )

    top_insights = "; ".join(item.message for item in insights.items[:2])
    suggestions = ["Show usage summary", "Which classes are full?", "How many students are active?"]
    return (
        f"Here is the latest operational summary from your real LMS data: {top_insights}",
        suggestions,
    )


def _fallback_session_summary(
    class_title: str,
    teacher_name: str,
    total_attended: int,
    duration_minutes: int,
    started_at: str,
) -> dict[str, Any]:
    """Structured fallback summary when OpenAI is not available."""
    attended_line = (
        f"{total_attended} student(s) attended" if total_attended > 0 else "No student attendance recorded"
    )
    duration_line = f"Session ran for approximately {duration_minutes} minute(s)" if duration_minutes > 0 else "Session duration unknown"
    return {
        "summary_text": (
            f"{teacher_name} completed a live session for {class_title} on {started_at}. "
            f"{attended_line}. {duration_line}."
        ),
        "key_points": [
            f"Class: {class_title}",
            f"Teacher: {teacher_name}",
            duration_line,
            attended_line,
        ],
        "action_items": [
            "Review any uploaded recording from this session",
            "Follow up with students who were absent",
            "Check attendance panel for individual join/leave times",
        ],
        "source_type": "fallback",
    }


def _call_openai_summary(
    class_title: str,
    teacher_name: str,
    total_attended: int,
    duration_minutes: int,
    started_at: str,
) -> dict[str, Any]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OpenAI API key is missing.")

    prompt = (
        f"Write a concise post-session summary for a live classroom session.\n\n"
        f"Class: {class_title}\n"
        f"Teacher: {teacher_name}\n"
        f"Date/Time: {started_at}\n"
        f"Duration: {duration_minutes} minute(s)\n"
        f"Students who attended: {total_attended}\n\n"
        "Return a JSON object with exactly these fields:\n"
        '- "summary_text": a 2-3 sentence overview\n'
        '- "key_points": an array of 3-4 short bullet strings\n'
        '- "action_items": an array of 2-3 follow-up action strings\n\n'
        "Respond only with valid JSON. No markdown, no code blocks."
    )

    body = {
        "model": OPENAI_MODEL,
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            }
        ],
    }

    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except (error.HTTPError, error.URLError) as exc:
        raise RuntimeError("OpenAI summary request failed.") from exc

    raw_text = _extract_output_text(response_payload)

    if not raw_text:
        raise RuntimeError("OpenAI returned empty summary.")

    try:
        parsed = json.loads(raw_text)
        return {
            "summary_text": str(parsed.get("summary_text", "")),
            "key_points": [str(p) for p in parsed.get("key_points", [])],
            "action_items": [str(a) for a in parsed.get("action_items", [])],
            "source_type": "ai",
        }
    except (json.JSONDecodeError, TypeError):
        raise RuntimeError("OpenAI returned non-JSON summary.")


def generate_session_summary(
    class_title: str,
    teacher_name: str,
    total_attended: int,
    duration_minutes: int,
    started_at: str,
) -> dict[str, Any]:
    """Generate a session summary using OpenAI if available, otherwise use fallback."""
    try:
        return _call_openai_summary(
            class_title=class_title,
            teacher_name=teacher_name,
            total_attended=total_attended,
            duration_minutes=duration_minutes,
            started_at=started_at,
        )
    except RuntimeError:
        return _fallback_session_summary(
            class_title=class_title,
            teacher_name=teacher_name,
            total_attended=total_attended,
            duration_minutes=duration_minutes,
            started_at=started_at,
        )


def answer_ai_chat(db: Session, current_user: User, question: str) -> AIChatResponse:
    cleaned_question = question.strip()

    if not cleaned_question:
        raise ValueError("Question is required.")

    snapshot = build_ai_snapshot(db, current_user)
    insights = build_ai_insights_from_snapshot(snapshot)

    try:
        answer = _call_openai(cleaned_question, snapshot, insights)
        suggestions = [item.title for item in insights.items[:3]]
        return AIChatResponse(answer=answer, suggestions=suggestions, source="openai")
    except RuntimeError as exc:
        logger.warning("OpenAI chat failed, using fallback: %s", exc)
        answer, suggestions = _fallback_answer(cleaned_question, snapshot, insights)
        return AIChatResponse(answer=answer, suggestions=suggestions, source="fallback")


def get_ai_insights(db: Session, current_user: User) -> AIInsightsResponse:
    try:
        snapshot = build_ai_snapshot(db, current_user)
        return build_ai_insights_from_snapshot(snapshot)
    except Exception as exc:
        logger.error("AI insights generation failed for %s: %s", current_user.email, exc, exc_info=True)
        return _build_default_ai_insights(current_user.role)
