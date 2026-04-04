"use client";

import { useEffect, useMemo, useState } from "react";

import {
  createAdminStudent,
  createAdminTeacher,
  deleteAdminStudent,
  deleteAdminTeacher,
  fetchAdminStudents,
  fetchAdminTeachers,
  updateAdminStudent,
  updateAdminTeacher,
  type AdminStudent,
  type AdminStudentInput,
  type AdminTeacher,
  type AdminTeacherInput,
  type UserStatus,
} from "@/lib/api";

type EntityType = "teachers" | "students";

type AdminUsersManagementProps = {
  entityType: EntityType;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  status: UserStatus;
};

const defaultFormState: UserFormState = {
  name: "",
  email: "",
  password: "",
  status: "active",
};

function isTeacherItem(
  item: AdminTeacher | AdminStudent,
): item is AdminTeacher {
  return "teacher_id" in item;
}

export function AdminUsersManagement({
  entityType,
}: AdminUsersManagementProps) {
  const isTeachers = entityType === "teachers";
  const [items, setItems] = useState<Array<AdminTeacher | AdminStudent>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [formState, setFormState] = useState<UserFormState>(defaultFormState);

  const heading = isTeachers ? "Teachers" : "Students";
  const singularLabel = isTeachers ? "teacher" : "student";

  async function loadItems() {
    try {
      setIsLoading(true);
      setError("");
      const response = isTeachers
        ? await fetchAdminTeachers()
        : await fetchAdminStudents();
      setItems(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to load ${entityType}.`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [entityType]);

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => left.name.localeCompare(right.name));
  }, [items]);

  function openCreateForm() {
    setEditingId("");
    setFormState(defaultFormState);
    setIsFormOpen(true);
    setSuccessMessage("");
    setError("");
  }

  function openEditForm(item: AdminTeacher | AdminStudent) {
    setEditingId(isTeacherItem(item) ? item.teacher_id : item.student_id);
    setFormState({
      name: item.name,
      email: item.email,
      password: "123456",
      status: item.status,
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
    const payload: AdminTeacherInput | AdminStudentInput = {
      name: formState.name.trim(),
      email: formState.email.trim(),
      password: formState.password,
      status: formState.status,
    };

    if (!payload.name || !payload.email || !payload.password) {
      setError(`Please complete all ${singularLabel} fields.`);
      return;
    }

    try {
      setBusyId(editingId || "create");
      setError("");

      if (isTeachers) {
        const savedTeacher = editingId
          ? await updateAdminTeacher(editingId, payload)
          : await createAdminTeacher(payload);

        setItems((currentItems) => {
          const nextItems = currentItems.filter(
            (item) =>
              "teacher_id" in item ? item.teacher_id !== savedTeacher.teacher_id : true,
          );
          return [...nextItems, savedTeacher];
        });
      } else {
        const savedStudent = editingId
          ? await updateAdminStudent(editingId, payload)
          : await createAdminStudent(payload);

        setItems((currentItems) => {
          const nextItems = currentItems.filter(
            (item) =>
              "student_id" in item ? item.student_id !== savedStudent.student_id : true,
          );
          return [...nextItems, savedStudent];
        });
      }

      setSuccessMessage(
        editingId
          ? `${heading.slice(0, -1)} updated successfully.`
          : `${heading.slice(0, -1)} added successfully.`,
      );
      closeForm();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to save ${singularLabel}.`,
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(item: AdminTeacher | AdminStudent) {
    const itemId = isTeacherItem(item) ? item.teacher_id : item.student_id;
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${singularLabel}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(itemId);
      setError("");

      if (isTeachers) {
        await deleteAdminTeacher(itemId);
      } else {
        await deleteAdminStudent(itemId);
      }

      setItems((currentItems) =>
        currentItems.filter((currentItem) =>
          isTeachers
            ? "teacher_id" in currentItem && currentItem.teacher_id !== itemId
            : "student_id" in currentItem && currentItem.student_id !== itemId,
        ),
      );
      setSuccessMessage(`${heading.slice(0, -1)} deleted successfully.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to delete ${singularLabel}.`,
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              {heading}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Keep nursery accounts tidy with a simple admin-friendly view.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100"
          >
            Add {heading.slice(0, -1)}
          </button>
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {isFormOpen ? (
          <div className="mt-5 rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
              {editingId ? `Edit ${heading.slice(0, -1)}` : `Add ${heading.slice(0, -1)}`}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    name: event.target.value,
                  }))
                }
                placeholder="Name"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400"
              />
              <input
                type="email"
                value={formState.email}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    email: event.target.value,
                  }))
                }
                placeholder="Email"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400"
              />
              <input
                type="text"
                value={formState.password}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    password: event.target.value,
                  }))
                }
                placeholder="Password"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400"
              />
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((currentState) => ({
                    ...currentState,
                    status: event.target.value as UserStatus,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
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
            Loading {entityType}...
          </div>
        ) : sortedItems.length ? (
          <div className="mt-5 space-y-4">
            {sortedItems.map((item) => {
              const itemId = isTeacherItem(item) ? item.teacher_id : item.student_id;
              const count = isTeacherItem(item)
                ? item.assigned_classes_count
                : item.enrolled_classes_count;

              return (
                <div
                  key={itemId}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-800">{item.name}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                        <span>{item.email}</span>
                        <span>
                          {isTeachers ? "Assigned classes" : "Enrolled classes"}: {count}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <div
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {item.status}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          disabled={busyId === itemId}
                          className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            No {entityType} are available yet.
          </div>
        )}
      </section>
    </div>
  );
}
