# Contact Management Web Application

A complete contact management web application built with **Codexirra**, using a React, Vite, TypeScript frontend, a FastAPI backend, and Postgres database.

This template was generated with [Codexirra](https://codexirra.com), an AI development workspace for building real web applications. Codexirra helps you generate, edit, preview, debug, and refine full-stack web apps from simple prompts.

> Want to build your own CRM, dashboard, portal, or SaaS app?  
> Try Codexirra: [https://codexirra.com](https://codexirra.com)

---

## Built with Codexirra

This project is an example of what can be created using Codexirra.

Codexirra can help generate complete web applications with:

- Frontend pages and components
- Backend API routes
- Database-aware app logic
- Clean SaaS-style UI layouts
- Forms, tables, dashboards, filters, and detail pages
- Full project structure
- Editable code and live preview

This contact management web application is designed as a practical business template for managing contacts, companies, notes, communication history, tags, and follow-up tasks.

---

## What this app does

This is a complete contact management web application for managing contacts, companies, notes, communication history, tags, and follow-up tasks.

It uses a modern SaaS-style dashboard with sidebar navigation, dashboard metrics, searchable contact tables, forms, filters, detail panels, and task workflows.

---

## Tech stack

- React
- Vite
- TypeScript
- Python
- FastAPI
- Postgres

---

## Features

- Contact dashboard with key metrics
- Searchable contact table
- Contact profile/detail panels
- Company management
- Notes and communication history
- Tags and contact categorisation
- Follow-up task workflows
- Forms for adding and editing contact data
- Filters for organising contacts
- Modern SaaS-style sidebar layout
- Postgres-backed data storage
- FastAPI backend routes
- Seed data for initial testing

## Project structure

- `/src` - React frontend application
- `/backend/app/main.py` - FastAPI backend, schema initialization, seed data, and API routes
- `/backend/requirements.txt` - Python dependencies
- `/backend/.env.example` - Example backend environment variables

## Running the app

Install frontend dependencies:

```bash
npm install
npm run dev
```

Install backend dependencies and run the API with Uvicorn:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set `DATABASE_URL` in the backend runtime environment before starting the API. The backend creates the required Postgres tables and seeds sample contacts if the database is empty.

## API base configuration

The frontend uses `VITE_API_URL` or `VITE_API_BASE_URL` when provided and normalizes the value so it ends in `/api`. If neither is configured, it uses same-origin `/api` paths for preview/proxy compatibility.

For local development, an optional Vite proxy can be enabled by setting `VITE_API_PROXY_TARGET`. No localhost proxy target is hardcoded in `vite.config.ts`.
