from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class BillingAccount(Base):
    __tablename__ = "billing_accounts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    school_name: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_email: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="starter")
    subscription_status: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="inactive",
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    classes_taught: Mapped[list["Classroom"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
    )
    live_sessions: Mapped[list["LiveSession"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
    )
    recordings: Mapped[list["Recording"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
    )
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="Attendance.student_id",
    )
    session_summaries: Mapped[list["SessionSummary"]] = relationship(
        back_populates="teacher",
        cascade="all, delete-orphan",
        foreign_keys="SessionSummary.teacher_id",
    )


class Classroom(Base):
    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    teacher: Mapped[User] = relationship(back_populates="classes_taught")
    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="classroom",
        cascade="all, delete-orphan",
    )
    live_sessions: Mapped[list["LiveSession"]] = relationship(
        back_populates="classroom",
        cascade="all, delete-orphan",
    )
    recordings: Mapped[list["Recording"]] = relationship(
        back_populates="classroom",
        cascade="all, delete-orphan",
    )
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="classroom",
        cascade="all, delete-orphan",
    )
    summaries: Mapped[list["SessionSummary"]] = relationship(
        back_populates="classroom",
        cascade="all, delete-orphan",
    )


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    classroom: Mapped[Classroom] = relationship(back_populates="enrollments")
    student: Mapped[User] = relationship(back_populates="enrollments")


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    participants_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    classroom: Mapped[Classroom] = relationship(back_populates="live_sessions")
    teacher: Mapped[User] = relationship(back_populates="live_sessions")
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
    )
    summary: Mapped["SessionSummary | None"] = relationship(
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="available")

    classroom: Mapped[Classroom] = relationship(back_populates="recordings")
    teacher: Mapped[User] = relationship(back_populates="recordings")


class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("live_sessions.id"), nullable=False, index=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="present")
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped[LiveSession] = relationship(back_populates="attendance_records")
    classroom: Mapped[Classroom] = relationship(back_populates="attendance_records")
    student: Mapped[User] = relationship(
        back_populates="attendance_records",
        foreign_keys=[student_id],
    )


class SessionSummary(Base):
    __tablename__ = "session_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("live_sessions.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"), nullable=False, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    key_points: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    action_items: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="fallback")

    session: Mapped[LiveSession] = relationship(back_populates="summary")
    classroom: Mapped[Classroom] = relationship(back_populates="summaries")
    teacher: Mapped[User] = relationship(
        back_populates="session_summaries",
        foreign_keys=[teacher_id],
    )
