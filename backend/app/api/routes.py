from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import UPLOAD_DIR


api_router = APIRouter(prefix="/api/v1", tags=["v1"])
RECORDINGS_DIR = UPLOAD_DIR / "recordings"
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

UserStatus = Literal["active", "inactive"]
ClassStatus = Literal["active", "archived"]
SessionStatus = Literal["live", "scheduled", "ended"]


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


class TeacherRecord(BaseModel):
    teacher_id: str
    name: str
    email: str
    password: str
    status: UserStatus


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


class StudentRecord(BaseModel):
    student_id: str
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


class ClassRecord(BaseModel):
    class_id: str
    title: str
    teacher_id: str
    student_ids: list[str] = Field(default_factory=list)
    status: ClassStatus


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


INITIAL_TEACHERS = [
    TeacherRecord(
        teacher_id="teacher-1",
        name="Teacher One",
        email="teacher1@wearekids.com",
        password="123456",
        status="active",
    ),
    TeacherRecord(
        teacher_id="teacher-2",
        name="Teacher Two",
        email="teacher2@wearekids.com",
        password="123456",
        status="active",
    ),
]

INITIAL_STUDENTS = [
    StudentRecord(
        student_id="student-1",
        name="Student One",
        email="student1@wearekids.com",
        password="123456",
        status="active",
    ),
    StudentRecord(
        student_id="student-2",
        name="Student Two",
        email="student2@wearekids.com",
        password="123456",
        status="active",
    ),
    StudentRecord(
        student_id="student-3",
        name="Student Three",
        email="student3@wearekids.com",
        password="123456",
        status="active",
    ),
    StudentRecord(
        student_id="student-4",
        name="Student Four",
        email="student4@wearekids.com",
        password="123456",
        status="active",
    ),
]

INITIAL_CLASSES = [
    ClassRecord(
        class_id="class-a",
        title="Reading and Science",
        teacher_id="teacher-1",
        student_ids=["student-1", "student-2"],
        status="active",
    ),
    ClassRecord(
        class_id="class-b",
        title="Creative Math and Stories",
        teacher_id="teacher-2",
        student_ids=["student-3", "student-4"],
        status="active",
    ),
]


teachers_store: dict[str, TeacherRecord] = {
    teacher.teacher_id: teacher.model_copy() for teacher in INITIAL_TEACHERS
}
students_store: dict[str, StudentRecord] = {
    student.student_id: student.model_copy() for student in INITIAL_STUDENTS
}
classes_store: dict[str, ClassRecord] = {
    classroom.class_id: classroom.model_copy() for classroom in INITIAL_CLASSES
}
live_class_sessions: dict[str, LiveClass] = {}
recordings_store: dict[str, RecordingItem] = {}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_teacher(teacher_id: str) -> TeacherRecord | None:
    return teachers_store.get(teacher_id)


def get_student(student_id: str) -> StudentRecord | None:
    return students_store.get(student_id)


def get_class(class_id: str) -> ClassRecord | None:
    return classes_store.get(class_id)


def get_teacher_by_email(email: str) -> TeacherRecord | None:
    normalized_email = normalize_email(email)

    for teacher in teachers_store.values():
        if teacher.email == normalized_email:
            return teacher

    return None


def find_class_for_teacher_email(email: str) -> ClassRecord | None:
    teacher = get_teacher_by_email(email)

    if not teacher:
        return None

    for classroom in classes_store.values():
        if classroom.teacher_id == teacher.teacher_id:
            return classroom

    return None


def build_teacher_summary(teacher: TeacherRecord) -> TeacherSummary:
    assigned_classes_count = sum(
        1 for classroom in classes_store.values() if classroom.teacher_id == teacher.teacher_id
    )
    return TeacherSummary(
        teacher_id=teacher.teacher_id,
        name=teacher.name,
        email=teacher.email,
        assigned_classes_count=assigned_classes_count,
        status=teacher.status,
    )


def build_student_summary(student: StudentRecord) -> StudentSummary:
    enrolled_classes_count = sum(
        1 for classroom in classes_store.values() if student.student_id in classroom.student_ids
    )
    return StudentSummary(
        student_id=student.student_id,
        name=student.name,
        email=student.email,
        enrolled_classes_count=enrolled_classes_count,
        status=student.status,
    )


def build_class_summary(classroom: ClassRecord) -> ClassSummary:
    teacher = get_teacher(classroom.teacher_id)
    live_session = live_class_sessions.get(classroom.class_id)
    live_status: SessionStatus

    if live_session and live_session.status == "live":
        live_status = "live"
    elif live_session and live_session.status == "ended":
        live_status = "ended"
    else:
        live_status = "scheduled"

    return ClassSummary(
        class_id=classroom.class_id,
        title=classroom.title,
        teacher_id=classroom.teacher_id,
        teacher_name=teacher.name if teacher else "Unassigned",
        student_ids=classroom.student_ids,
        enrolled_students_count=len(classroom.student_ids),
        status=classroom.status,
        live_status=live_status,
    )


def build_live_session_summary(session: LiveClass) -> LiveSessionSummary:
    return LiveSessionSummary(
        class_id=session.class_id,
        title=session.title,
        teacher_name=session.teacher_name,
        participants_count=session.participants_count,
        start_time=session.started_at,
        status=session.status,
    )


def build_scheduled_session(class_id: str) -> LiveClass | None:
    classroom = get_class(class_id)

    if not classroom:
        return None

    teacher = get_teacher(classroom.teacher_id)

    if not teacher:
        return None

    return LiveClass(
        class_id=classroom.class_id,
        teacher_name=teacher.name,
        teacher_email=teacher.email,
        title=classroom.title,
        status="scheduled",
        participants_count=0,
        started_at=None,
    )


def get_live_or_scheduled_class(class_id: str) -> LiveClass | None:
    session = live_class_sessions.get(class_id)

    if session:
        return session

    return build_scheduled_session(class_id)


def set_class_participants_count(class_id: str, participants_count: int) -> LiveClass | None:
    session = get_live_or_scheduled_class(class_id)

    if not session:
        return None

    updated_session = session.model_copy(
        update={
            "participants_count": participants_count,
            "status": "live" if participants_count > 0 else session.status,
        }
    )
    live_class_sessions[class_id] = updated_session
    return updated_session


def mark_class_as_ended(class_id: str) -> LiveClass | None:
    session = get_live_or_scheduled_class(class_id)

    if not session:
        return None

    updated_session = session.model_copy(
        update={
            "status": "ended",
            "participants_count": 0,
        }
    )
    live_class_sessions[class_id] = updated_session
    return updated_session


def validate_unique_teacher_email(email: str, exclude_teacher_id: str | None = None) -> None:
    normalized_email = normalize_email(email)

    for teacher in teachers_store.values():
        if teacher.teacher_id != exclude_teacher_id and teacher.email == normalized_email:
            raise HTTPException(status_code=400, detail="Teacher email already exists.")


def validate_unique_student_email(email: str, exclude_student_id: str | None = None) -> None:
    normalized_email = normalize_email(email)

    for student in students_store.values():
        if student.student_id != exclude_student_id and student.email == normalized_email:
            raise HTTPException(status_code=400, detail="Student email already exists.")


def validate_class_relationships(teacher_id: str, student_ids: list[str]) -> None:
    teacher = get_teacher(teacher_id)

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    for student_id in student_ids:
        if not get_student(student_id):
            raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")


def get_recording(recording_id: str) -> RecordingItem | None:
    return recordings_store.get(recording_id)


def is_recording_expired(recording: RecordingItem) -> bool:
    return recording.expires_at <= datetime.now(timezone.utc)


def delete_recording_file(recording: RecordingItem) -> None:
    file_path = Path(recording.file_path)

    if file_path.exists():
        file_path.unlink()


def delete_recording(recording_id: str) -> None:
    recording = recordings_store.pop(recording_id, None)

    if not recording:
        return

    delete_recording_file(recording)


def cleanup_expired_recordings() -> None:
    expired_recording_ids = [
        recording_id
        for recording_id, recording in recordings_store.items()
        if is_recording_expired(recording)
    ]

    for recording_id in expired_recording_ids:
        delete_recording(recording_id)


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
        ],
    }


@api_router.get("/classes/live", response_model=list[LiveClass])
def get_live_classes() -> list[LiveClass]:
    return [
        session
        for session in live_class_sessions.values()
        if session.status == "live"
    ]


@api_router.post("/classes/start", response_model=LiveClass)
def start_class_session(payload: StartClassRequest) -> LiveClass:
    classroom = find_class_for_teacher_email(payload.teacher_email)

    if not classroom:
        raise HTTPException(status_code=404, detail="Teacher class not found.")

    teacher = get_teacher(classroom.teacher_id)

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    existing_session = live_class_sessions.get(classroom.class_id)
    started_at = (
        existing_session.started_at
        if existing_session and existing_session.started_at
        else datetime.now(timezone.utc)
    )
    participant_count = existing_session.participants_count if existing_session else 1

    session = LiveClass(
        class_id=classroom.class_id,
        teacher_name=teacher.name,
        teacher_email=teacher.email,
        title=classroom.title,
        status="live",
        participants_count=max(participant_count, 1),
        started_at=started_at,
    )

    live_class_sessions[session.class_id] = session
    return session


@api_router.get("/classes/{class_id}", response_model=LiveClass)
def get_class_session(class_id: str) -> LiveClass:
    session = get_live_or_scheduled_class(class_id)

    if not session:
        raise HTTPException(status_code=404, detail="Class session not found.")

    return session


@api_router.post("/recordings/upload", response_model=RecordingItem)
async def upload_recording(
    class_id: str = Form(...),
    teacher_name: str = Form(...),
    title: str = Form(...),
    recorded_file: UploadFile = File(...),
) -> RecordingItem:
    recording_id = uuid4().hex
    file_suffix = Path(recorded_file.filename or "recording.webm").suffix or ".webm"
    file_name = f"{recording_id}{file_suffix}"
    destination_path = RECORDINGS_DIR / file_name
    file_bytes = await recorded_file.read()
    destination_path.write_bytes(file_bytes)

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(days=5)

    recording = RecordingItem(
        recording_id=recording_id,
        class_id=class_id,
        title=title,
        teacher=teacher_name,
        created_at=created_at,
        file_path=str(destination_path),
        file_url=f"/uploads/recordings/{file_name}",
        expires_at=expires_at,
    )
    recordings_store[recording_id] = recording
    return recording


@api_router.get("/recordings", response_model=list[RecordingItem])
def get_recordings() -> list[RecordingItem]:
    cleanup_expired_recordings()
    return sorted(
        recordings_store.values(),
        key=lambda recording: recording.created_at,
        reverse=True,
    )


@api_router.get("/recordings/{recording_id}", response_model=RecordingItem)
def get_recording_by_id(recording_id: str) -> RecordingItem:
    recording = get_recording(recording_id)

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found.")

    if is_recording_expired(recording):
        delete_recording(recording_id)
        raise HTTPException(
            status_code=410,
            detail="This recording has expired and is no longer available.",
        )

    cleanup_expired_recordings()

    return recording


@api_router.patch("/recordings/{recording_id}", response_model=RecordingUpdateResponse)
def update_recording_by_id(
    recording_id: str,
    payload: RecordingUpdateRequest,
) -> RecordingUpdateResponse:
    cleanup_expired_recordings()
    recording = get_recording(recording_id)

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found.")

    cleaned_title = payload.title.strip()

    if not cleaned_title:
        raise HTTPException(status_code=400, detail="Recording title is required.")

    updated_recording = recording.model_copy(update={"title": cleaned_title})
    recordings_store[recording_id] = updated_recording

    return RecordingUpdateResponse(success=True, recording=updated_recording)


@api_router.delete("/recordings/{recording_id}", response_model=RecordingDeleteResponse)
def delete_recording_by_id(recording_id: str) -> RecordingDeleteResponse:
    cleanup_expired_recordings()
    recording = get_recording(recording_id)

    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found.")

    delete_recording(recording_id)
    return RecordingDeleteResponse(success=True, recording_id=recording_id)


@api_router.get("/admin/teachers", response_model=list[TeacherSummary])
def get_admin_teachers() -> list[TeacherSummary]:
    return sorted(
        [build_teacher_summary(teacher) for teacher in teachers_store.values()],
        key=lambda teacher: teacher.name,
    )


@api_router.post("/admin/teachers", response_model=TeacherSummary)
def create_admin_teacher(payload: TeacherCreateRequest) -> TeacherSummary:
    validate_unique_teacher_email(payload.email)
    teacher = TeacherRecord(
        teacher_id=f"teacher-{uuid4().hex[:8]}",
        name=payload.name.strip(),
        email=normalize_email(payload.email),
        password=payload.password,
        status=payload.status,
    )
    teachers_store[teacher.teacher_id] = teacher
    return build_teacher_summary(teacher)


@api_router.patch("/admin/teachers/{teacher_id}", response_model=TeacherSummary)
def update_admin_teacher(
    teacher_id: str,
    payload: TeacherUpdateRequest,
) -> TeacherSummary:
    teacher = get_teacher(teacher_id)

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    validate_unique_teacher_email(payload.email, exclude_teacher_id=teacher_id)
    updated_teacher = teacher.model_copy(
        update={
            "name": payload.name.strip(),
            "email": normalize_email(payload.email),
            "password": payload.password,
            "status": payload.status,
        }
    )
    teachers_store[teacher_id] = updated_teacher

    for session_class_id, session in list(live_class_sessions.items()):
        if session.teacher_email == teacher.email:
            live_class_sessions[session_class_id] = session.model_copy(
                update={
                    "teacher_name": updated_teacher.name,
                    "teacher_email": updated_teacher.email,
                }
            )

    return build_teacher_summary(updated_teacher)


@api_router.delete("/admin/teachers/{teacher_id}", response_model=SuccessResponse)
def delete_admin_teacher(teacher_id: str) -> SuccessResponse:
    teacher = teachers_store.pop(teacher_id, None)

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    classes_to_delete = [
        classroom.class_id
        for classroom in classes_store.values()
        if classroom.teacher_id == teacher_id
    ]

    for class_id in classes_to_delete:
        classes_store.pop(class_id, None)
        live_class_sessions.pop(class_id, None)

    return SuccessResponse(success=True, message="Teacher deleted successfully.")


@api_router.get("/admin/students", response_model=list[StudentSummary])
def get_admin_students() -> list[StudentSummary]:
    return sorted(
        [build_student_summary(student) for student in students_store.values()],
        key=lambda student: student.name,
    )


@api_router.post("/admin/students", response_model=StudentSummary)
def create_admin_student(payload: StudentCreateRequest) -> StudentSummary:
    validate_unique_student_email(payload.email)
    student = StudentRecord(
        student_id=f"student-{uuid4().hex[:8]}",
        name=payload.name.strip(),
        email=normalize_email(payload.email),
        password=payload.password,
        status=payload.status,
    )
    students_store[student.student_id] = student
    return build_student_summary(student)


@api_router.patch("/admin/students/{student_id}", response_model=StudentSummary)
def update_admin_student(
    student_id: str,
    payload: StudentUpdateRequest,
) -> StudentSummary:
    student = get_student(student_id)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    validate_unique_student_email(payload.email, exclude_student_id=student_id)
    updated_student = student.model_copy(
        update={
            "name": payload.name.strip(),
            "email": normalize_email(payload.email),
            "password": payload.password,
            "status": payload.status,
        }
    )
    students_store[student_id] = updated_student
    return build_student_summary(updated_student)


@api_router.delete("/admin/students/{student_id}", response_model=SuccessResponse)
def delete_admin_student(student_id: str) -> SuccessResponse:
    student = students_store.pop(student_id, None)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    for class_id, classroom in list(classes_store.items()):
        if student_id in classroom.student_ids:
            classes_store[class_id] = classroom.model_copy(
                update={
                    "student_ids": [
                        current_student_id
                        for current_student_id in classroom.student_ids
                        if current_student_id != student_id
                    ]
                }
            )

    return SuccessResponse(success=True, message="Student deleted successfully.")


@api_router.get("/admin/classes", response_model=list[ClassSummary])
def get_admin_classes() -> list[ClassSummary]:
    return sorted(
        [build_class_summary(classroom) for classroom in classes_store.values()],
        key=lambda classroom: classroom.title,
    )


@api_router.post("/admin/classes", response_model=ClassSummary)
def create_admin_class(payload: ClassCreateRequest) -> ClassSummary:
    validate_class_relationships(payload.teacher_id, payload.student_ids)
    class_id = f"class-{uuid4().hex[:8]}"
    classroom = ClassRecord(
        class_id=class_id,
        title=payload.title.strip(),
        teacher_id=payload.teacher_id,
        student_ids=payload.student_ids,
        status=payload.status,
    )
    classes_store[classroom.class_id] = classroom
    return build_class_summary(classroom)


@api_router.patch("/admin/classes/{class_id}", response_model=ClassSummary)
def update_admin_class(
    class_id: str,
    payload: ClassUpdateRequest,
) -> ClassSummary:
    classroom = get_class(class_id)

    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found.")

    validate_class_relationships(payload.teacher_id, payload.student_ids)
    updated_classroom = classroom.model_copy(
        update={
            "title": payload.title.strip(),
            "teacher_id": payload.teacher_id,
            "student_ids": payload.student_ids,
            "status": payload.status,
        }
    )
    classes_store[class_id] = updated_classroom

    existing_session = live_class_sessions.get(class_id)
    teacher = get_teacher(updated_classroom.teacher_id)

    if existing_session and teacher:
        live_class_sessions[class_id] = existing_session.model_copy(
            update={
                "title": updated_classroom.title,
                "teacher_name": teacher.name,
                "teacher_email": teacher.email,
            }
        )

    return build_class_summary(updated_classroom)


@api_router.delete("/admin/classes/{class_id}", response_model=SuccessResponse)
def delete_admin_class(class_id: str) -> SuccessResponse:
    classroom = classes_store.pop(class_id, None)

    if not classroom:
        raise HTTPException(status_code=404, detail="Class not found.")

    live_class_sessions.pop(class_id, None)
    return SuccessResponse(success=True, message="Class deleted successfully.")


@api_router.get("/admin/live-sessions", response_model=list[LiveSessionSummary])
def get_admin_live_sessions() -> list[LiveSessionSummary]:
    return sorted(
        [
            build_live_session_summary(session)
            for session in live_class_sessions.values()
            if session.status == "live"
        ],
        key=lambda session: session.start_time or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )


@api_router.post(
    "/admin/live-sessions/{class_id}/end",
    response_model=SuccessResponse,
)
def end_admin_live_session(class_id: str) -> SuccessResponse:
    session = live_class_sessions.get(class_id)

    if not session or session.status != "live":
        raise HTTPException(status_code=404, detail="Live session not found.")

    mark_class_as_ended(class_id)
    return SuccessResponse(success=True, message="Live session ended successfully.")
