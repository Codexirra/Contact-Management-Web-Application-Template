# ContactFlow Backend

FastAPI backend for the ContactFlow CRM application.

## Requirements

- Python 3.10+
- Postgres database
- `DATABASE_URL` environment variable

Install dependencies:

```bash
pip install -r requirements.txt
```

Run with Uvicorn:

```bash
uvicorn app.main:app --reload
```

The application exports the FastAPI object as `app` from `/backend/app/main.py`.

## Environment

Copy `/backend/.env.example` as a reference for runtime variables. Do not commit real secrets.

Required:

- `DATABASE_URL` - Postgres connection string

Optional:

- `CORS_ORIGINS` - comma-separated origins, defaults to `*`

## Main endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/contacts/{contact_id}`
- `PUT /api/contacts/{contact_id}`
- `POST /api/contacts/{contact_id}/notes`
- `POST /api/contacts/{contact_id}/communications`
- `POST /api/contacts/{contact_id}/tasks`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/tags`
- `POST /api/tags`
- `GET /api/tasks`
- `PATCH /api/tasks/{task_id}`
