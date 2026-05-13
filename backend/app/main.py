import os
from datetime import date, datetime, timedelta
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(override=False)

DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI(title="ContactFlow CRM API", version="1.0.0")

origins_value = os.getenv("CORS_ORIGINS", "*")
origins = [origin.strip() for origin in origins_value.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompanyIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    domain: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None

class TagIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    color: str = "#2563eb"

class ContactIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=160)
    phone: Optional[str] = None
    title: Optional[str] = None
    status: str = "prospect"
    company_id: Optional[int] = None
    tag_ids: list[int] = []

class NoteIn(BaseModel):
    body: str = Field(min_length=2)

class CommunicationIn(BaseModel):
    channel: str = "email"
    summary: str = Field(min_length=2)
    occurred_at: Optional[datetime] = None

class TaskIn(BaseModel):
    title: str = Field(min_length=2)
    due_date: date
    priority: str = "medium"

class TaskPatch(BaseModel):
    completed: bool

def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def init_db() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(160) NOT NULL UNIQUE,
                    domain VARCHAR(160),
                    industry VARCHAR(120),
                    size VARCHAR(80),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS contacts (
                    id SERIAL PRIMARY KEY,
                    first_name VARCHAR(80) NOT NULL,
                    last_name VARCHAR(80) NOT NULL,
                    email VARCHAR(160) NOT NULL UNIQUE,
                    phone VARCHAR(80),
                    title VARCHAR(160),
                    status VARCHAR(40) NOT NULL DEFAULT 'prospect',
                    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS tags (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(40) NOT NULL UNIQUE,
                    color VARCHAR(20) NOT NULL DEFAULT '#2563eb'
                );
                CREATE TABLE IF NOT EXISTS contact_tags (
                    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (contact_id, tag_id)
                );
                CREATE TABLE IF NOT EXISTS notes (
                    id SERIAL PRIMARY KEY,
                    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                    body TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS communications (
                    id SERIAL PRIMARY KEY,
                    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                    channel VARCHAR(40) NOT NULL,
                    summary TEXT NOT NULL,
                    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                    title VARCHAR(180) NOT NULL,
                    due_date DATE NOT NULL,
                    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                    completed BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute("SELECT COUNT(*) AS count FROM contacts")
            if cur.fetchone()["count"] == 0:
                seed_data(cur)
        conn.commit()

def seed_data(cur) -> None:
    companies = [
        ("Northstar Analytics", "northstar.io", "Business Intelligence", "51-200"),
        ("Brightline Studios", "brightline.design", "Creative Services", "11-50"),
        ("Summit Health Group", "summithealth.example", "Healthcare", "201-500"),
    ]
    company_ids = []
    for company in companies:
        cur.execute("INSERT INTO companies (name, domain, industry, size) VALUES (%s,%s,%s,%s) RETURNING id", company)
        company_ids.append(cur.fetchone()["id"])
    tags = [("Decision Maker", "#7c3aed"), ("Warm Lead", "#ea580c"), ("Customer", "#16a34a"), ("Needs Follow-up", "#dc2626")]
    tag_ids = []
    for tag in tags:
        cur.execute("INSERT INTO tags (name, color) VALUES (%s,%s) RETURNING id", tag)
        tag_ids.append(cur.fetchone()["id"])
    contacts = [
        ("Ava", "Patel", "ava.patel@northstar.io", "+1 415 555 0123", "VP of Revenue", "customer", company_ids[0], [tag_ids[0], tag_ids[2]]),
        ("Marcus", "Reed", "marcus@brightline.design", "+1 312 555 0199", "Founder", "prospect", company_ids[1], [tag_ids[0], tag_ids[1], tag_ids[3]]),
        ("Elena", "Garcia", "elena.garcia@summithealth.example", "+1 646 555 0148", "Operations Director", "active", company_ids[2], [tag_ids[1]]),
        ("Theo", "Kim", "theo.kim@northstar.io", "+1 415 555 0108", "Analytics Manager", "active", company_ids[0], [tag_ids[2]]),
    ]
    for c in contacts:
        cur.execute(
            "INSERT INTO contacts (first_name,last_name,email,phone,title,status,company_id) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            c[:7],
        )
        contact_id = cur.fetchone()["id"]
        for tag_id in c[7]:
            cur.execute("INSERT INTO contact_tags (contact_id, tag_id) VALUES (%s,%s)", (contact_id, tag_id))
        cur.execute("INSERT INTO notes (contact_id, body) VALUES (%s,%s)", (contact_id, "Initial relationship context captured during onboarding."))
        cur.execute("INSERT INTO communications (contact_id, channel, summary, occurred_at) VALUES (%s,%s,%s,%s)", (contact_id, "email", "Shared product overview and next-step resources.", datetime.utcnow() - timedelta(days=contact_id)))
        cur.execute("INSERT INTO tasks (contact_id, title, due_date, priority) VALUES (%s,%s,%s,%s)", (contact_id, "Schedule relationship check-in", date.today() + timedelta(days=contact_id + 1), "high" if contact_id == 2 else "medium"))

def fetch_tags_for_contact(cur, contact_id: int) -> list[dict[str, Any]]:
    cur.execute(
        "SELECT t.id, t.name, t.color FROM tags t JOIN contact_tags ct ON ct.tag_id=t.id WHERE ct.contact_id=%s ORDER BY t.name",
        (contact_id,),
    )
    return cur.fetchall()

def hydrate_contact(cur, row: dict[str, Any], include_detail: bool = False) -> dict[str, Any]:
    contact = dict(row)
    contact["full_name"] = f"{row['first_name']} {row['last_name']}"
    contact["tags"] = fetch_tags_for_contact(cur, row["id"])
    if include_detail:
        cur.execute("SELECT id, body, created_at FROM notes WHERE contact_id=%s ORDER BY created_at DESC", (row["id"],))
        contact["notes"] = cur.fetchall()
        cur.execute("SELECT id, channel, summary, occurred_at FROM communications WHERE contact_id=%s ORDER BY occurred_at DESC", (row["id"],))
        contact["communications"] = cur.fetchall()
        cur.execute("SELECT id, title, due_date, priority, completed, created_at FROM tasks WHERE contact_id=%s ORDER BY completed ASC, due_date ASC", (row["id"],))
        contact["tasks"] = cur.fetchall()
    return contact

def set_contact_tags(cur, contact_id: int, tag_ids: list[int]) -> None:
    cur.execute("DELETE FROM contact_tags WHERE contact_id=%s", (contact_id,))
    for tag_id in tag_ids:
        cur.execute("INSERT INTO contact_tags (contact_id, tag_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (contact_id, tag_id))

@app.on_event("startup")
def on_startup() -> None:
    init_db()

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS count FROM contacts")
        contacts = cur.fetchone()["count"]
        cur.execute("SELECT COUNT(*) AS count FROM companies")
        companies = cur.fetchone()["count"]
        cur.execute("SELECT COUNT(*) AS count FROM tasks WHERE completed=false")
        open_tasks = cur.fetchone()["count"]
        cur.execute("SELECT COUNT(*) AS count FROM communications WHERE occurred_at >= NOW() - INTERVAL '14 days'")
        recent_comms = cur.fetchone()["count"]
        cur.execute(
            """
            SELECT t.id, t.title, t.due_date, t.priority, t.completed,
                   c.id AS contact_id, c.first_name, c.last_name, co.name AS company_name
            FROM tasks t
            JOIN contacts c ON c.id=t.contact_id
            LEFT JOIN companies co ON co.id=c.company_id
            WHERE t.completed=false
            ORDER BY t.due_date ASC
            LIMIT 6
            """
        )
        upcoming_tasks = cur.fetchall()
        cur.execute(
            """
            SELECT cm.id, cm.channel, cm.summary, cm.occurred_at,
                   c.id AS contact_id, c.first_name, c.last_name
            FROM communications cm
            JOIN contacts c ON c.id=cm.contact_id
            ORDER BY cm.occurred_at DESC
            LIMIT 6
            """
        )
        recent_activity = cur.fetchall()
    return {"stats": {"contacts": contacts, "companies": companies, "open_tasks": open_tasks, "recent_communications": recent_comms}, "upcoming_tasks": upcoming_tasks, "recent_activity": recent_activity}

@app.get("/api/companies")
def list_companies() -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT co.*, COUNT(c.id) AS contact_count
            FROM companies co
            LEFT JOIN contacts c ON c.company_id=co.id
            GROUP BY co.id
            ORDER BY co.name
            """
        )
        return cur.fetchall()

@app.post("/api/companies")
def create_company(payload: CompanyIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        try:
            cur.execute("INSERT INTO companies (name, domain, industry, size) VALUES (%s,%s,%s,%s) RETURNING *", (payload.name, payload.domain, payload.industry, payload.size))
            company = cur.fetchone()
            conn.commit()
            company["contact_count"] = 0
            return company
        except psycopg.errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="A company with this name already exists")

@app.get("/api/tags")
def list_tags() -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM tags ORDER BY name")
        return cur.fetchall()

@app.post("/api/tags")
def create_tag(payload: TagIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        try:
            cur.execute("INSERT INTO tags (name, color) VALUES (%s,%s) RETURNING *", (payload.name, payload.color))
            tag = cur.fetchone()
            conn.commit()
            return tag
        except psycopg.errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="A tag with this name already exists")

@app.get("/api/contacts")
def list_contacts(search: str = "", status: str = "", company_id: Optional[int] = None, tag_id: Optional[int] = None) -> list[dict[str, Any]]:
    clauses = []
    params: list[Any] = []
    if search:
        clauses.append("(LOWER(c.first_name || ' ' || c.last_name) LIKE %s OR LOWER(c.email) LIKE %s OR LOWER(co.name) LIKE %s)")
        term = f"%{search.lower()}%"
        params.extend([term, term, term])
    if status:
        clauses.append("c.status=%s")
        params.append(status)
    if company_id:
        clauses.append("c.company_id=%s")
        params.append(company_id)
    if tag_id:
        clauses.append("EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id=c.id AND ct.tag_id=%s)")
        params.append(tag_id)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    sql = f"""
        SELECT c.*, co.name AS company_name
        FROM contacts c
        LEFT JOIN companies co ON co.id=c.company_id
        {where}
        ORDER BY c.updated_at DESC, c.last_name ASC
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [hydrate_contact(cur, row) for row in rows]

@app.post("/api/contacts")
def create_contact(payload: ContactIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        try:
            cur.execute(
                "INSERT INTO contacts (first_name,last_name,email,phone,title,status,company_id) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
                (payload.first_name, payload.last_name, payload.email, payload.phone, payload.title, payload.status, payload.company_id),
            )
            row = cur.fetchone()
            set_contact_tags(cur, row["id"], payload.tag_ids)
            conn.commit()
        except psycopg.errors.UniqueViolation:
            raise HTTPException(status_code=409, detail="A contact with this email already exists")
    return get_contact(row["id"])

@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: int) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT c.*, co.name AS company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=%s", (contact_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found")
        return hydrate_contact(cur, row, include_detail=True)

@app.put("/api/contacts/{contact_id}")
def update_contact(contact_id: int, payload: ContactIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE contacts SET first_name=%s,last_name=%s,email=%s,phone=%s,title=%s,status=%s,company_id=%s,updated_at=NOW()
            WHERE id=%s RETURNING id
            """,
            (payload.first_name, payload.last_name, payload.email, payload.phone, payload.title, payload.status, payload.company_id, contact_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Contact not found")
        set_contact_tags(cur, contact_id, payload.tag_ids)
        conn.commit()
    return get_contact(contact_id)

@app.post("/api/contacts/{contact_id}/notes")
def add_note(contact_id: int, payload: NoteIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM contacts WHERE id=%s", (contact_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Contact not found")
        cur.execute("INSERT INTO notes (contact_id, body) VALUES (%s,%s) RETURNING id, body, created_at", (contact_id, payload.body))
        note = cur.fetchone()
        conn.commit()
        return note

@app.post("/api/contacts/{contact_id}/communications")
def add_communication(contact_id: int, payload: CommunicationIn) -> dict[str, Any]:
    occurred_at = payload.occurred_at or datetime.utcnow()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM contacts WHERE id=%s", (contact_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Contact not found")
        cur.execute("INSERT INTO communications (contact_id, channel, summary, occurred_at) VALUES (%s,%s,%s,%s) RETURNING id, channel, summary, occurred_at", (contact_id, payload.channel, payload.summary, occurred_at))
        comm = cur.fetchone()
        conn.commit()
        return comm

@app.post("/api/contacts/{contact_id}/tasks")
def add_task(contact_id: int, payload: TaskIn) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM contacts WHERE id=%s", (contact_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Contact not found")
        cur.execute("INSERT INTO tasks (contact_id, title, due_date, priority) VALUES (%s,%s,%s,%s) RETURNING id, title, due_date, priority, completed, created_at", (contact_id, payload.title, payload.due_date, payload.priority))
        task = cur.fetchone()
        conn.commit()
        return task

@app.get("/api/tasks")
def list_tasks() -> list[dict[str, Any]]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.*, c.first_name, c.last_name, c.email, co.name AS company_name
            FROM tasks t
            JOIN contacts c ON c.id=t.contact_id
            LEFT JOIN companies co ON co.id=c.company_id
            ORDER BY t.completed ASC, t.due_date ASC
            """
        )
        return cur.fetchall()

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskPatch) -> dict[str, Any]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("UPDATE tasks SET completed=%s WHERE id=%s RETURNING id, title, due_date, priority, completed, contact_id, created_at", (payload.completed, task_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.commit()
        return row
