import json
from datetime import timedelta
from typing import Any
from urllib import error, request

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models import Classroom, Enrollment, LiveSession, Recording, User
from app.schemas import AIInsightItem, AIInsightsResponse, AIChatResponse, SessionSummaryResponse
from app.services import (
    build_billing_usage_summary,
    get_or_create_billing_account,
    get_teacher_by_email,
    get_latest_session_for_class,
    utc_now,
)


FULL_CLASS_THRESHOLD = 8


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
    recent_live_sessions = [
        session for session in live_sessions if session.started_at and session.started_at >= recent_session_cutoff
    ]
    recent_recordings = [
        recording for recording in recordings if recording.created_at >= recent_recording_cutoff
    ]
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
        },
        "full_class_threshold": FULL_CLASS_THRESHOLD,
    }


def build_ai_insights_from_snapshot(snapshot: dict[str, Any]) -> AIInsightsResponse:
    items: list[AIInsightItem] = []
    usage = snapshot["usage"]
    counts = snapshot["counts"]
    classes = snapshot["classes"]
    scope = snapshot["scope"]

    for index, warning in enumerate(usage["warnings"][:3]):
        items.append(
            AIInsightItem(
                id=f"usage-warning-{index}",
                title="Capacity signal",
                message=warning,
                severity="warning",
                cta_label="Open Billing",
                cta_href="/admin/billing" if scope == "admin" else None,
            )
        )

    if usage["teachers"]["is_at_limit"] or usage["students"]["is_at_limit"] or usage["classes"]["is_at_limit"]:
        items.append(
            AIInsightItem(
                id="upgrade-recommended",
                title="Upgrade recommended",
                message="Your current plan is blocking growth in at least one area. Upgrading will unlock more teachers, students, or classes.",
                severity="critical",
                cta_label="View Plans",
                cta_href="/pricing" if scope == "admin" else None,
            )
        )

    if snapshot["recent_activity"]["recent_live_sessions"] == 0:
        items.append(
            AIInsightItem(
                id="low-live-activity",
                title="Class engagement looks low",
                message="No live sessions have been started in the last 7 days. Consider scheduling a new lesson or checking teacher activity.",
                severity="warning",
                cta_label="Review Live Sessions",
                cta_href="/admin/live-sessions" if scope == "admin" else "/teacher/dashboard",
            )
        )

    if snapshot["recent_activity"]["recent_recordings"] == 0:
        items.append(
            AIInsightItem(
                id="recording-activity",
                title="Recordings need attention",
                message="No new recordings were created in the last 7 days. Recording a recent lesson can improve replay access for families and staff.",
                severity="info",
                cta_label="Manage Recordings",
                cta_href="/admin/recordings" if scope == "admin" else "/teacher/recordings",
            )
        )

    full_classes = [classroom for classroom in classes if classroom["is_full"]]

    if full_classes:
        items.append(
            AIInsightItem(
                id="full-classes",
                title="Some classes are full",
                message=(
                    f"{len(full_classes)} class(es) have {snapshot['full_class_threshold']} or more enrolled students. "
                    "Adding another class may help distribute workload."
                ),
                severity="info",
                cta_label="Manage Classes",
                cta_href="/admin/classes" if scope == "admin" else None,
            )
        )

    if counts["recordings_expiring_soon"] > 0:
        items.append(
            AIInsightItem(
                id="recordings-expiring",
                title="Recordings expiring soon",
                message=f"{counts['recordings_expiring_soon']} recording(s) will expire within 2 days. Review or replace important lessons soon.",
                severity="info",
                cta_label="Open Recordings",
                cta_href="/admin/recordings" if scope == "admin" else "/teacher/recordings",
            )
        )

    if not items:
        items.append(
            AIInsightItem(
                id="all-clear",
                title="Healthy operations",
                message="Your current setup looks stable. Usage is under control and recent activity signals are healthy.",
                severity="info",
            )
        )

    summary = items[0].message if items else "No insights available."
    return AIInsightsResponse(generated_at=utc_now(), summary=summary, items=items[:5])


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
        with request.urlopen(req, timeout=30) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI request failed: {detail or exc.reason}") from exc
    except error.URLError as exc:
        raise RuntimeError("OpenAI request could not be completed.") from exc

    answer = _extract_output_text(response_payload)

    if not answer:
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
    except RuntimeError:
        answer, suggestions = _fallback_answer(cleaned_question, snapshot, insights)
        return AIChatResponse(answer=answer, suggestions=suggestions, source="fallback")


def get_ai_insights(db: Session, current_user: User) -> AIInsightsResponse:
    snapshot = build_ai_snapshot(db, current_user)
    return build_ai_insights_from_snapshot(snapshot)
