"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  createAdminClass,
  deleteAdminClass,
  fetchAdminClasses,
  fetchAdminStudents,
  fetchAdminTeachers,
  updateAdminClass,
  type AdminClass,
  type AdminClassInput,
  type AdminStudent,
  type AdminTeacher,
  type ClassStatus,
} from "@/lib/api";

type ClassFormState = {
  title: string;
  teacher_id: string;
  student_ids: string[];
  status: ClassStatus;
};

const defaultFormState: ClassFormState = {
  title: "",
  teacher_id: "",
  student_ids: [],
  status: "active",
};

export function AdminClassesManagement() {
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [formState, setFormState] = useState<ClassFormState>(defaultFormState);
  const isLimitError =
    error.includes("Upgrade your plan") || error.includes("plan allows up to");

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");
      const [classesResponse, teachersResponse, studentsResponse] = await Promise.all([
        fetchAdminClasses(),
        fetchAdminTeachers(),
        fetchAdminStudents(),
      ]);
      setClasses(classesResponse);
      setTeachers(teachersResponse);
      setStudents(studentsResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load classes.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((left, right) => left.title.localeCompare(right.title));
  }, [classes]);

  function openCreateForm() {
    setEditingId("");
    setFormState({
      ...defaultFormState,
      teacher_id: teachers[0]?.teacher_id ?? "",
    });
    setIsFormOpen(true);
    setSuccessMessage("");
    setError("");
  }

  function openEditForm(classroom: AdminClass) {
    setEditingId(classroom.class_id);
    setFormState({
      title: classroom.title,
      teacher_id: classroom.teacher_id,
      student_ids: classroom.student_ids,
      status: classroom.status,
    });
    setIsFormOpen(true);
    setSuccessMessage("");
    setError("");
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId("");
    setFormState(defaultFormState);
  }

  async function handleSubmit() {
    const payload: AdminClassInput = {
      title: formState.title.trim(),
      teacher_id: formState.teacher_id,
      student_ids: formState.student_ids,
      status: formState.status,
    };

    if (!payload.title || !payload.teacher_id) {
      setError("Please complete the class title and teacher fields.");
      return;
    }

    try {
      setBusyId(editingId || "create");
      setError("");
      const savedClass = editingId
        ? await updateAdminClass(editingId, payload)
        : await createAdminClass(payload);

      setClasses((currentClasses) => {
        const nextClasses = currentClasses.filter(
          (classroom) => classroom.class_id !== savedClass.class_id,
        );
        return [...nextClasses, savedClass];
      });
      setSuccessMessage(
        editingId ? "Class updated successfully." : "Class created successfully.",
      );
      closeForm();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save class.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(classId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this class?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(classId);
      setError("");
      await deleteAdminClass(classId);
      setClasses((currentClasses) =>
        currentClasses.filter((classroom) => classroom.class_id !== classId),
      );
      setSuccessMessage("Class deleted successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete class.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            Classes
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Create and update nursery classes with teacher and student assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100"
        >
          Create Class
        </button>
      </div>

      {successMessage ? (
        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
          <p>{error}</p>
          {isLimitError ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white"
              >
                View Plans
              </Link>
              <Link
                href="/admin/billing"
                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700"
              >
                Upgrade Plan
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="mt-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
            {editingId ? "Edit Class" : "Add Class"}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input
              type="text"
              value={formState.title}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  title: event.target.value,
                }))
              }
              placeholder="Class title"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400"
            />
            <select
              value={formState.teacher_id}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  teacher_id: event.target.value,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <select
              multiple
              value={formState.student_ids}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  student_ids: Array.from(event.target.selectedOptions, (option) => option.value),
                }))
              }
              className="min-h-40 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              {students.map((student) => (
                <option key={student.student_id} value={student.student_id}>
                  {student.name}
                </option>
              ))}
            </select>
            <select
              value={formState.status}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  status: event.target.value as ClassStatus,
                }))
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Hold Ctrl or Command to select multiple students.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busyId === (editingId || "create")}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {editingId ? "Save Changes" : "Create"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          Loading classes...
        </div>
      ) : sortedClasses.length ? (
        <div className="mt-5 space-y-4">
          {sortedClasses.map((classroom) => (
            <div
              key={classroom.class_id}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-800">
                    {classroom.title}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>Class ID: {classroom.class_id}</span>
                    <span>Teacher: {classroom.teacher_name}</span>
                    <span>Students: {classroom.enrolled_students_count}</span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                      classroom.live_status === "live"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {classroom.live_status}
                  </div>
                  <div
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                      classroom.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {classroom.status}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(classroom)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(classroom.class_id)}
                      disabled={busyId === classroom.class_id}
                      className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
          No classes are available yet.
        </div>
      )}
    </section>
  );
}
