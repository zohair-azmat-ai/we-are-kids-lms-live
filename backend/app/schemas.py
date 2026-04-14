from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


UserStatus = Literal["active", "inactive"]
ClassStatus = Literal["active", "archived"]
SessionStatus = Literal["live", "scheduled", "ended"]
ClassroomRole = Literal["teacher", "student"]
BillingPlan = Literal["starter", "standard", "premium"]


class LiveClass(BaseModel):
    class_id: str
    teacher_name: str
    teacher_email: str
    title: str
    status: SessionStatus
    participants_count: int
    started_at: datetime | None = None


class StartClassRequest(BaseModel):
    teacher_email: str


class EndClassRequest(BaseModel):
    teacher_email: str


class RecordingItem(BaseModel):
    recording_id: str
    class_id: str
    title: str
    teacher: str
    created_at: datetime
    file_path: str
    file_url: str
    cloud_url: str
    expires_at: datetime
    status: str


class RecordingUpdateRequest(BaseModel):
    title: str


class RecordingUpdateResponse(BaseModel):
    success: bool
    recording: RecordingItem


class RecordingDeleteResponse(BaseModel):
    success: bool


class RecordingStartRequest(BaseModel):
    class_id: str
    title: str


class RecordingStartResponse(BaseModel):
    recording_id: str
    message: str


class RecordingStopRequest(BaseModel):
    recording_id: str


class TeacherSummary(BaseModel):
    teacher_id: str
    name: str
    email: str
    assigned_classes_count: int
    status: UserStatus


class TeacherCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    status: UserStatus


class TeacherUpdateRequest(BaseModel):
    name: str
    email: str
    password: str
    status: UserStatus


class StudentSummary(BaseModel):
    student_id: str
    name: str
    email: str
    enrolled_classes_count: int
    status: UserStatus


class StudentCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    status: UserStatus


class StudentUpdateRequest(BaseModel):
    name: str
    email: str
    password: str
    status: UserStatus


class ClassSummary(BaseModel):
    class_id: str
    title: str
    teacher_id: str
    teacher_name: str
    student_ids: list[str]
    enrolled_students_count: int
    status: ClassStatus
    live_status: SessionStatus


class ClassCreateRequest(BaseModel):
    title: str
    teacher_id: str
    student_ids: list[str] = Field(default_factory=list)
    status: ClassStatus


class ClassUpdateRequest(BaseModel):
    title: str
    teacher_id: str
    student_ids: list[str] = Field(default_factory=list)
    status: ClassStatus


class LiveSessionSummary(BaseModel):
    class_id: str
    title: str
    teacher_name: str
    participants_count: int
    start_time: datetime | None
    status: SessionStatus


class SuccessResponse(BaseModel):
    success: bool
    message: str


class ClassroomPresenceRequest(BaseModel):
    role: ClassroomRole
    participant_email: str | None = None
    participant_name: str | None = None


class AuthLoginRequest(BaseModel):
    email: str
    password: str
    role: Literal["admin", "teacher", "student"]


class AuthRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Literal["teacher", "student"]


class AuthUser(BaseModel):
    user_id: str
    name: str
    email: str
    role: Literal["admin", "teacher", "student"]
    status: UserStatus


class AuthLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: AuthUser


class BillingPlanFeatures(BaseModel):
    teachers_limit: int | None
    students_limit: int | None
    classes_limit: int | None
    recordings_access: Literal["basic", "full"]
    priority_features: bool
    monthly_label: str
    audience: str
    highlights: list[str]


class BillingPlanInfo(BaseModel):
    code: BillingPlan
    name: str
    description: str
    is_current: bool
    features: BillingPlanFeatures


class BillingSubscription(BaseModel):
    school_name: str
    billing_email: str
    plan: BillingPlan
    subscription_status: str
    current_period_end: datetime | None
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    plans: list[BillingPlanInfo]
    teachers_count: int
    students_count: int
    classes_count: int


class BillingUsageMetric(BaseModel):
    current: int
    limit: int | None
    remaining: int | None
    is_unlimited: bool
    percent_used: int
    is_near_limit: bool
    is_at_limit: bool
    upgrade_message: str | None = None


class BillingUsageSummary(BaseModel):
    plan: BillingPlan
    subscription_status: str
    teacher_count: int
    teacher_limit: int | None
    student_count: int
    student_limit: int | None
    class_count: int
    class_limit: int | None
    teachers: BillingUsageMetric
    students: BillingUsageMetric
    classes: BillingUsageMetric
    recordings_access: Literal["basic", "full"]
    priority_features: bool
    warnings: list[str]


class AIChatRequest(BaseModel):
    question: str


class AIChatResponse(BaseModel):
    answer: str
    suggestions: list[str]
    source: Literal["openai", "fallback"]


class AIInsightItem(BaseModel):
    id: str
    alert_type: Literal["capacity", "upgrade", "engagement", "status"]
    title: str
    message: str
    severity: Literal["info", "warning", "critical"]
    cta_label: str | None = None
    cta_href: str | None = None


class AIInsightsResponse(BaseModel):
    generated_at: datetime
    summary: str
    items: list[AIInsightItem]


class ActivityPoint(BaseModel):
    label: str
    value: int


class AdminAnalyticsResponse(BaseModel):
    total_users: int
    total_teachers: int
    total_students: int
    active_classes: int
    live_sessions_count: int
    recordings_count: int
    active_students: int
    activity_change_label: str
    class_fill_ratio: int
    plan_usage_summary: BillingUsageSummary
    live_activity_points: list[ActivityPoint]
    recording_activity_points: list[ActivityPoint]


class TeacherAnalyticsResponse(BaseModel):
    assigned_classes: int
    live_sessions_run: int
    recordings_created: int
    enrolled_students: int
    active_students: int
    average_class_size: int
    participation_summary: str
    live_activity_points: list[ActivityPoint]


class BillingCheckoutRequest(BaseModel):
    admin_email: str
    plan: BillingPlan
    app_url: str


class BillingCheckoutResponse(BaseModel):
    checkout_url: str


class BillingSubscriptionRequest(BaseModel):
    admin_email: str


class BillingCustomerPortalRequest(BaseModel):
    admin_email: str
    app_url: str


class BillingCustomerPortalResponse(BaseModel):
    portal_url: str


class AttendanceRecord(BaseModel):
    id: int
    session_id: str
    class_id: str
    class_title: str
    student_id: str
    student_name: str
    student_email: str
    joined_at: datetime
    left_at: datetime | None = None
    status: str
    duration_minutes: int | None = None


class AttendanceSummary(BaseModel):
    session_id: str
    class_id: str
    class_title: str
    session_status: str
    started_at: datetime | None
    total_attended: int
    currently_present: int
    records: list[AttendanceRecord]


class SessionSummaryResponse(BaseModel):
    id: int
    session_id: str
    class_id: str
    class_title: str
    teacher_name: str
    summary_text: str
    key_points: list[str]
    action_items: list[str]
    generated_at: datetime
    source_type: str
    total_attended: int
    started_at: datetime | None


class AgoraTokenResponse(BaseModel):
    token: str
    app_id: str
    channel: str
    uid: int
