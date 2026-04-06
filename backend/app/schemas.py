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
    expires_at: datetime


class RecordingUpdateRequest(BaseModel):
    title: str


class RecordingUpdateResponse(BaseModel):
    success: bool
    recording: RecordingItem


class RecordingDeleteResponse(BaseModel):
    success: bool
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


class LiveKitTokenRequest(BaseModel):
    room_name: str
    participant_name: str
    role: ClassroomRole
    participant_email: str | None = None


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room_name: str
    participant_name: str


class ClassroomPresenceRequest(BaseModel):
    role: ClassroomRole
    participant_email: str | None = None
    participant_name: str | None = None


class BillingPlanFeatures(BaseModel):
    teachers_limit: int
    students_limit: int
    classes_limit: int
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
