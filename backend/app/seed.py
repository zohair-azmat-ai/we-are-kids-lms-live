from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password, password_needs_rehash
from app.models import BillingAccount, Classroom, Enrollment, User


DEMO_USERS = [
    {
        "id": "admin-1",
        "name": "Admin User",
        "email": "admin@wearekids.com",
        "password": "123456",
        "role": "admin",
        "status": "active",
    },
    {
        "id": "teacher-1",
        "name": "Teacher One",
        "email": "teacher1@wearekids.com",
        "password": "123456",
        "role": "teacher",
        "status": "active",
    },
    {
        "id": "teacher-2",
        "name": "Teacher Two",
        "email": "teacher2@wearekids.com",
        "password": "123456",
        "role": "teacher",
        "status": "active",
    },
    {
        "id": "student-1",
        "name": "Student One",
        "email": "student1@wearekids.com",
        "password": "123456",
        "role": "student",
        "status": "active",
    },
    {
        "id": "student-2",
        "name": "Student Two",
        "email": "student2@wearekids.com",
        "password": "123456",
        "role": "student",
        "status": "active",
    },
    {
        "id": "student-3",
        "name": "Student Three",
        "email": "student3@wearekids.com",
        "password": "123456",
        "role": "student",
        "status": "active",
    },
    {
        "id": "student-4",
        "name": "Student Four",
        "email": "student4@wearekids.com",
        "password": "123456",
        "role": "student",
        "status": "active",
    },
]

DEMO_CLASSES = [
    {
        "id": "class-a",
        "title": "Reading and Science",
        "teacher_id": "teacher-1",
        "status": "active",
    },
    {
        "id": "class-b",
        "title": "Creative Math and Stories",
        "teacher_id": "teacher-2",
        "status": "active",
    },
]

DEMO_ENROLLMENTS = [
    {"class_id": "class-a", "student_id": "student-1"},
    {"class_id": "class-a", "student_id": "student-2"},
    {"class_id": "class-b", "student_id": "student-3"},
    {"class_id": "class-b", "student_id": "student-4"},
]


def seed_demo_data(db: Session) -> None:
    for user_data in DEMO_USERS:
        existing_user = db.scalar(select(User).where(User.id == user_data["id"]))

        if existing_user:
            if password_needs_rehash(existing_user.password):
                existing_user.password = hash_password(user_data["password"])
            continue

        db.add(
            User(
                **{
                    **user_data,
                    "password": hash_password(user_data["password"]),
                }
            )
        )

    db.flush()

    for class_data in DEMO_CLASSES:
        existing_class = db.scalar(select(Classroom).where(Classroom.id == class_data["id"]))

        if existing_class:
            continue

        db.add(Classroom(**class_data))

    db.flush()

    for enrollment_data in DEMO_ENROLLMENTS:
        existing_enrollment = db.scalar(
            select(Enrollment).where(
                Enrollment.class_id == enrollment_data["class_id"],
                Enrollment.student_id == enrollment_data["student_id"],
            )
        )

        if existing_enrollment:
            continue

        db.add(Enrollment(**enrollment_data))

    existing_account = db.scalar(select(BillingAccount).where(BillingAccount.id == "school-account-1"))

    if not existing_account:
        db.add(
            BillingAccount(
                id="school-account-1",
                school_name="We Are Kids Nursery",
                billing_email="admin@wearekids.com",
                plan="starter",
                subscription_status="inactive",
                current_period_end=None,
            )
        )

    db.commit()
