import type { Company, Contact, ContactDetail, ContactPayload, Dashboard, FollowUpTask, Tag } from "./types";

const normalizeApiBase = (value?: string) => { const base = (value || "/api").replace(/\/+$/, ""); return base.endsWith("/api") ? base : `${base}/api`; };

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep default message.
    }
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  dashboard: () => request<Dashboard>("/dashboard"),
  companies: () => request<Company[]>("/companies"),
  createCompany: (payload: Partial<Company>) => request<Company>("/companies", { method: "POST", body: JSON.stringify(payload) }),
  tags: () => request<Tag[]>("/tags"),
  createTag: (payload: { name: string; color: string }) => request<Tag>("/tags", { method: "POST", body: JSON.stringify(payload) }),
  contacts: (params: Record<string, string>) => {
    const query = new URLSearchParams(params);
    return request<Contact[]>(`/contacts${query.toString() ? `?${query}` : ""}`);
  },
  contact: (id: number) => request<ContactDetail>(`/contacts/${id}`),
  createContact: (payload: ContactPayload) => request<ContactDetail>("/contacts", { method: "POST", body: JSON.stringify(payload) }),
  updateContact: (id: number, payload: ContactPayload) => request<ContactDetail>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  addNote: (id: number, body: string) => request(`/contacts/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  addCommunication: (id: number, payload: { channel: string; summary: string }) => request(`/contacts/${id}/communications`, { method: "POST", body: JSON.stringify(payload) }),
  addTask: (id: number, payload: { title: string; due_date: string; priority: string }) => request(`/contacts/${id}/tasks`, { method: "POST", body: JSON.stringify(payload) }),
  tasks: () => request<FollowUpTask[]>("/tasks"),
  updateTask: (id: number, completed: boolean) => request<FollowUpTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) })
};
