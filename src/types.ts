export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Company = {
  id: number;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  created_at: string;
  contact_count?: number;
};

export type Note = {
  id: number;
  body: string;
  created_at: string;
};

export type Communication = {
  id: number;
  channel: string;
  summary: string;
  occurred_at: string;
};

export type FollowUpTask = {
  id: number;
  contact_id: number;
  title: string;
  due_date: string;
  priority: string;
  completed: boolean;
  created_at?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company_name?: string | null;
};

export type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  status: string;
  company_id?: number | null;
  company_name?: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
};

export type ContactDetail = Contact & {
  notes: Note[];
  communications: Communication[];
  tasks: FollowUpTask[];
};

export type Dashboard = {
  stats: {
    contacts: number;
    companies: number;
    open_tasks: number;
    recent_communications: number;
  };
  upcoming_tasks: Array<FollowUpTask & { first_name: string; last_name: string; company_name?: string | null }>;
  recent_activity: Array<Communication & { contact_id: number; first_name: string; last_name: string }>;
};

export type ContactPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  status: string;
  company_id?: number | null;
  tag_ids: number[];
};
