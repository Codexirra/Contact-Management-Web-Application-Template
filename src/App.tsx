import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Company, Contact, ContactDetail, ContactPayload, Dashboard, FollowUpTask, Tag } from "./types";

type View = "dashboard" | "contacts" | "companies" | "tasks";

const statuses = ["prospect", "active", "customer", "inactive"];
const priorities = ["low", "medium", "high"];
const tagColors = ["#2563eb", "#7c3aed", "#16a34a", "#ea580c", "#dc2626", "#0891b2"];

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value?: string) => (value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—");
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", status: "", tag_id: "" });

  const loadAll = async () => {
    setError(null);
    setLoading(true);
    try {
      const [dashboardData, companyData, tagData, taskData] = await Promise.all([api.dashboard(), api.companies(), api.tags(), api.tasks()]);
      setDashboard(dashboardData);
      setCompanies(companyData);
      setTags(tagData);
      setTasks(taskData);
      await loadContacts(filters, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load application data");
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (nextFilters = filters, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      setContacts(await api.contacts(params));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load contacts");
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    const [dashboardData, companyData, tagData, taskData] = await Promise.all([api.dashboard(), api.companies(), api.tags(), api.tasks()]);
    setDashboard(dashboardData);
    setCompanies(companyData);
    setTags(tagData);
    setTasks(taskData);
    await loadContacts(filters, false);
    if (selectedContactId) setSelectedContact(await api.contact(selectedContactId));
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadContacts(filters);
  }, [filters.search, filters.status, filters.tag_id]);

  useEffect(() => {
    if (!selectedContactId) {
      setSelectedContact(null);
      return;
    }
    api.contact(selectedContactId).then(setSelectedContact).catch((err) => setError(err.message));
  }, [selectedContactId]);

  const openContact = (contactId: number) => {
    setSelectedContactId(contactId);
    setView("contacts");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">CF</div><div><strong>ContactFlow</strong><span>Relationship CRM</span></div></div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}>Contacts</button>
          <button className={view === "companies" ? "active" : ""} onClick={() => setView("companies")}>Companies</button>
          <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>Follow-ups</button>
        </nav>
        <div className="sidebar-card"><span>Pipeline hygiene</span><strong>{dashboard?.stats.open_tasks ?? 0} open follow-ups</strong><p>Keep every relationship moving with timely next actions.</p></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Modern contact management</p><h1>{view === "dashboard" ? "Relationship dashboard" : view === "contacts" ? "Contacts" : view === "companies" ? "Companies" : "Follow-up tasks"}</h1></div>
          <button className="primary" onClick={() => { setEditingContact(null); setShowContactForm(true); }}>+ New contact</button>
        </header>

        {error && <div className="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
        {loading && <div className="loading">Loading your workspace…</div>}

        {!loading && view === "dashboard" && dashboard && <DashboardView dashboard={dashboard} openContact={openContact} />}
        {!loading && view === "contacts" && (
          <ContactsView
            contacts={contacts}
            tags={tags}
            companies={companies}
            filters={filters}
            setFilters={setFilters}
            selectedContact={selectedContact}
            openContact={openContact}
            onEdit={(contact) => { setEditingContact(contact); setShowContactForm(true); }}
            onCloseDetail={() => setSelectedContactId(null)}
            onRefresh={refreshAfterMutation}
          />
        )}
        {!loading && view === "companies" && <CompaniesView companies={companies} onRefresh={refreshAfterMutation} />}
        {!loading && view === "tasks" && <TasksView tasks={tasks} onToggle={async (task) => { await api.updateTask(task.id, !task.completed); await refreshAfterMutation(); }} openContact={openContact} />}
      </main>

      {showContactForm && (
        <ContactForm
          contact={editingContact}
          companies={companies}
          tags={tags}
          onCancel={() => setShowContactForm(false)}
          onSave={async (payload) => {
            if (editingContact) await api.updateContact(editingContact.id, payload);
            else await api.createContact(payload);
            setShowContactForm(false);
            await refreshAfterMutation();
          }}
        />
      )}
    </div>
  );
}

function DashboardView({ dashboard, openContact }: { dashboard: Dashboard; openContact: (id: number) => void }) {
  return <section className="stack">
    <div className="stats-grid">
      <Stat label="Total contacts" value={dashboard.stats.contacts} note="People in your relationship database" />
      <Stat label="Companies" value={dashboard.stats.companies} note="Accounts and organizations" />
      <Stat label="Open follow-ups" value={dashboard.stats.open_tasks} note="Tasks requiring action" />
      <Stat label="Recent conversations" value={dashboard.stats.recent_communications} note="Logged in the last 14 days" />
    </div>
    <div className="two-column">
      <div className="panel"><div className="panel-head"><h2>Upcoming follow-ups</h2><span>Next 6</span></div>{dashboard.upcoming_tasks.length === 0 ? <Empty text="No open follow-ups. Great work." /> : dashboard.upcoming_tasks.map((task) => <button className="task-row" key={task.id} onClick={() => openContact(task.contact_id)}><div><strong>{task.title}</strong><span>{task.first_name} {task.last_name} · {task.company_name || "Independent"}</span></div><Badge text={formatDate(task.due_date)} tone={task.priority} /></button>)}</div>
      <div className="panel"><div className="panel-head"><h2>Recent communication</h2><span>Timeline</span></div>{dashboard.recent_activity.map((item) => <button className="activity" key={item.id} onClick={() => openContact(item.contact_id)}><span className="channel">{item.channel}</span><div><strong>{item.first_name} {item.last_name}</strong><p>{item.summary}</p><small>{formatDate(item.occurred_at)}</small></div></button>)}</div>
    </div>
  </section>;
}

function ContactsView(props: { contacts: Contact[]; tags: Tag[]; companies: Company[]; filters: { search: string; status: string; tag_id: string }; setFilters: (f: { search: string; status: string; tag_id: string }) => void; selectedContact: ContactDetail | null; openContact: (id: number) => void; onEdit: (c: Contact) => void; onCloseDetail: () => void; onRefresh: () => Promise<void>; }) {
  return <section className="contacts-layout">
    <div className="panel contacts-panel">
      <div className="filters">
        <input placeholder="Search by name, email, or company" value={props.filters.search} onChange={(e) => props.setFilters({ ...props.filters, search: e.target.value })} />
        <select value={props.filters.status} onChange={(e) => props.setFilters({ ...props.filters, status: e.target.value })}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={props.filters.tag_id} onChange={(e) => props.setFilters({ ...props.filters, tag_id: e.target.value })}><option value="">All tags</option>{props.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
      </div>
      {props.contacts.length === 0 ? <Empty text="No contacts match your filters." /> : <table><thead><tr><th>Name</th><th>Company</th><th>Status</th><th>Tags</th><th></th></tr></thead><tbody>{props.contacts.map((contact) => <tr key={contact.id}><td><button className="person" onClick={() => props.openContact(contact.id)}><span className="avatar">{initials(contact.full_name)}</span><span><strong>{contact.full_name}</strong><small>{contact.email}</small></span></button></td><td>{contact.company_name || "—"}</td><td><Badge text={contact.status} tone={contact.status} /></td><td><TagList tags={contact.tags} /></td><td><button className="ghost" onClick={() => props.onEdit(contact)}>Edit</button></td></tr>)}</tbody></table>}
    </div>
    <ContactDetailPanel contact={props.selectedContact} onClose={props.onCloseDetail} onRefresh={props.onRefresh} />
  </section>;
}

function ContactDetailPanel({ contact, onClose, onRefresh }: { contact: ContactDetail | null; onClose: () => void; onRefresh: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [channel, setChannel] = useState("email");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [priority, setPriority] = useState("medium");
  if (!contact) return <aside className="detail empty-detail"><Empty text="Select a contact to view notes, communication history, and follow-ups." /></aside>;
  const submit = async (type: "note" | "communication" | "task") => {
    if (type === "note" && note.trim()) { await api.addNote(contact.id, note); setNote(""); }
    if (type === "communication" && summary.trim()) { await api.addCommunication(contact.id, { channel, summary }); setSummary(""); }
    if (type === "task" && taskTitle.trim()) { await api.addTask(contact.id, { title: taskTitle, due_date: dueDate, priority }); setTaskTitle(""); }
    await onRefresh();
  };
  return <aside className="detail">
    <button className="close" onClick={onClose}>×</button>
    <div className="profile"><div className="avatar large">{initials(contact.full_name)}</div><h2>{contact.full_name}</h2><p>{contact.title || "Contact"} {contact.company_name ? `at ${contact.company_name}` : ""}</p><TagList tags={contact.tags} /></div>
    <div className="meta-grid"><span>Email<strong>{contact.email}</strong></span><span>Phone<strong>{contact.phone || "—"}</strong></span><span>Status<strong>{contact.status}</strong></span></div>
    <Composer title="Add note" value={note} setValue={setNote} placeholder="Capture context, preferences, or meeting notes…" onSubmit={() => submit("note")} />
    <div className="composer"><h3>Log communication</h3><select value={channel} onChange={(e) => setChannel(e.target.value)}><option>email</option><option>call</option><option>meeting</option><option>sms</option></select><textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summarize the conversation…" /><button onClick={() => submit("communication")}>Log activity</button></div>
    <div className="composer"><h3>Create follow-up</h3><input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" /><div className="inline"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /><select value={priority} onChange={(e) => setPriority(e.target.value)}>{priorities.map((p) => <option key={p}>{p}</option>)}</select></div><button onClick={() => submit("task")}>Create task</button></div>
    <Timeline title="Notes" items={contact.notes.map((n) => ({ id: n.id, label: formatDate(n.created_at), body: n.body }))} />
    <Timeline title="Communication history" items={contact.communications.map((c) => ({ id: c.id, label: `${c.channel} · ${formatDate(c.occurred_at)}`, body: c.summary }))} />
    <div className="panel-sub"><h3>Follow-up tasks</h3>{contact.tasks.map((task) => <label className="check-row" key={task.id}><input type="checkbox" checked={task.completed} onChange={async () => { await api.updateTask(task.id, !task.completed); await onRefresh(); }} /><span><strong>{task.title}</strong><small>{formatDate(task.due_date)} · {task.priority}</small></span></label>)}</div>
  </aside>;
}

function ContactForm({ contact, companies, tags, onCancel, onSave }: { contact: Contact | null; companies: Company[]; tags: Tag[]; onCancel: () => void; onSave: (payload: ContactPayload) => Promise<void> }) {
  const [form, setForm] = useState<ContactPayload>({ first_name: contact?.first_name || "", last_name: contact?.last_name || "", email: contact?.email || "", phone: contact?.phone || "", title: contact?.title || "", status: contact?.status || "prospect", company_id: contact?.company_id || null, tag_ids: contact?.tags.map((t) => t.id) || [] });
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); await onSave(form); setSaving(false); };
  const toggleTag = (id: number) => setForm((current) => ({ ...current, tag_ids: current.tag_ids.includes(id) ? current.tag_ids.filter((tagId) => tagId !== id) : [...current.tag_ids, id] }));
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="panel-head"><h2>{contact ? "Edit contact" : "Create contact"}</h2><button type="button" className="close" onClick={onCancel}>×</button></div><div className="form-grid"><input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /><input required placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /><input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select><select value={form.company_id || ""} onChange={(e) => setForm({ ...form, company_id: e.target.value ? Number(e.target.value) : null })}><option value="">No company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div><div className="tag-picker">{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={form.tag_ids.includes(tag.id)} onChange={() => toggleTag(tag.id)} /><span style={{ background: tag.color }} />{tag.name}</label>)}</div><div className="modal-actions"><button type="button" className="ghost" onClick={onCancel}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save contact"}</button></div></form></div>;
}

function CompaniesView({ companies, onRefresh }: { companies: Company[]; onRefresh: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", domain: "", industry: "", size: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); await api.createCompany(form); setForm({ name: "", domain: "", industry: "", size: "" }); await onRefresh(); };
  return <section className="two-column"><div className="panel"><div className="panel-head"><h2>Company directory</h2><span>{companies.length} accounts</span></div><table><thead><tr><th>Name</th><th>Industry</th><th>Size</th><th>Contacts</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id}><td><strong>{company.name}</strong><small>{company.domain}</small></td><td>{company.industry || "—"}</td><td>{company.size || "—"}</td><td>{company.contact_count || 0}</td></tr>)}</tbody></table></div><form className="panel form-panel" onSubmit={submit}><h2>Add company</h2><input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} /><input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /><input placeholder="Company size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /><button className="primary">Create company</button></form></section>;
}

function TasksView({ tasks, onToggle, openContact }: { tasks: FollowUpTask[]; onToggle: (task: FollowUpTask) => Promise<void>; openContact: (id: number) => void }) {
  const open = tasks.filter((task) => !task.completed).length;
  return <section className="panel"><div className="panel-head"><h2>Follow-up command center</h2><span>{open} open</span></div>{tasks.length === 0 ? <Empty text="No follow-up tasks yet." /> : tasks.map((task) => <div className={`task-line ${task.completed ? "done" : ""}`} key={task.id}><label><input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} /><span><strong>{task.title}</strong><small>{task.first_name} {task.last_name} · {task.company_name || "Independent"}</small></span></label><div><Badge text={task.priority} tone={task.priority} /><button className="ghost" onClick={() => openContact(task.contact_id)}>Open contact</button><span>{formatDate(task.due_date)}</span></div></div>)}</section>;
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) { return <div className="stat"><span>{label}</span><strong>{value}</strong><p>{note}</p></div>; }
function Badge({ text, tone }: { text: string; tone?: string }) { return <span className={`badge ${tone || ""}`}>{text}</span>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function TagList({ tags }: { tags: Tag[] }) { return <div className="tags">{tags.map((tag) => <span key={tag.id} style={{ borderColor: tag.color, color: tag.color }}>{tag.name}</span>)}</div>; }
function Composer({ title, value, setValue, placeholder, onSubmit }: { title: string; value: string; setValue: (v: string) => void; placeholder: string; onSubmit: () => void }) { return <div className="composer"><h3>{title}</h3><textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} /><button onClick={onSubmit}>Save note</button></div>; }
function Timeline({ title, items }: { title: string; items: { id: number; label: string; body: string }[] }) { return <div className="panel-sub"><h3>{title}</h3>{items.length === 0 ? <Empty text="Nothing logged yet." /> : items.map((item) => <div className="timeline" key={item.id}><small>{item.label}</small><p>{item.body}</p></div>)}</div>; }
