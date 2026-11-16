# Maju Jaya Approval Workspace

React/Vite frontend and Express/Sequelize backend in one repository, using a separately managed PostgreSQL database.

## Setup

Requires Node.js 22.12+ and a running PostgreSQL server.

1. Run `npm install` from the repository root.
2. Edit the root `.env` using `.env.example` as a template. Set `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_PORT` to your own PostgreSQL connection details. Replace the example `JWT_SECRET` with your own random secret of at least 32 characters.
3. Create the database specified by `DB_NAME` in PostgreSQL, using pgAdmin or your preferred SQL client.
4. Run `npm run db:migrate` to create the application tables.
5. Run `npm run db:import` to import the provided departments, employees, and historical requests.
6. Run `npm run dev` to start the frontend and backend.

Frontend: http://localhost:5173. Backend: http://localhost:8000/api/health with the example port. Vite reads `PORT` from the root `.env` for its API proxy; restart Vite after changing the port.

The application uses your separately managed PostgreSQL server. `npm run db:import` explicitly applies the tracked `002-history-json` data migration using the three root JSON files. There are no seeders, embedded PostgreSQL dependencies, or scripts folders. The regular server never reads these files.

The import creates 7 departments, 26 employees, and 30 historical requests on an empty database. Existing IDs, account passwords, and request decisions are preserved. All imported rows and activity entries commit together; a successful import is recorded in `schema_migrations`, so rerunning the command skips it. Original employee/request records are retained in JSONB `source` fields.

New imported accounts use **Welcome123!** as a temporary local password. Set `IMPORT_PASSWORD` in your environment before importing to choose a different password (minimum 10 characters; required in production). Existing accounts are never reset. Example active accounts: `joko.s@ptmajujaya.co.id` (employee), `agus.supriyadi@ptmajujaya.co.id` (manager), and `rina.wijaya@ptmajujaya.co.id` (HR). Inactive accounts cannot sign in.

Legacy DD/MM/YYYY dates are normalized; timestamps without a timezone are interpreted in Asia/Jakarta. Missing departments/managers become null foreign keys with warnings; circular reporting chains use the department-manager/director fallback for request assignment. Invalid request details, inactive submitters, possible duplicates, and historical decisions by a different manager are flagged while historical statuses are preserved.

## Environment configuration

```env
PORT=8000
DB_HOST=localhost
DB_USER=postgres
DB_PASS=password_anda
DB_NAME=prism_db
DB_PORT=5432
JWT_SECRET=NccBTYTo1hLdPXj6bpjXV1PRDBM7Vdam
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
DB_LOGGING=false
```

`.env` is ignored by Git. `backend/config/env.js` loads these values; `backend/config/database.js` passes the separate database settings to Sequelize. Set `DB_LOGGING=true` to log SQL statements.

## Structure

- `frontend/src/pages/`: application screens.
- `frontend/src/components/`: shared interface elements.
- `frontend/src/api/`: Axios client and requests by feature.
- `frontend/src/contexts/`: shared authentication state.
- `backend/index.js`: server startup; `app.js`: Express configuration and routes.
- `backend/routes/`: endpoints and validation.
- `backend/middleware/`: authentication, permissions, and transactional activity logging.
- `backend/controllers/`: request handling and business logic.
- `backend/models/`: Sequelize definitions and associations.
- `backend/config/`: environment and PostgreSQL configuration.
- `backend/migrations/`: versioned schema and migration entry point.

Feature flow: React page ? API module ? Express route ? middleware ? controller ? Sequelize model ? PostgreSQL.

## Functionality

Employees can submit purchase, leave, and overtime requests and cancel pending requests. Only the assigned approver can approve or reject a request; rejection requires a reason. HR and the director can view company requests and the employee directory, but cannot override approval assignment. Decisions and activity events commit together, with row locks preventing competing decisions. The frontend provides filtering, request details, activity timelines, and responsive layouts.

The data migration populates `issues` and `source` for imported records. No JSON files are loaded by the running application. Reporting fallbacks, self-approval prevention, invalid-date checks, positive purchase costs, and an application overtime limit of 12 hours remain enforced. The 12-hour limit is an application assumption, not employment-law advice.

## Verification

```sh
npm test
npm run build
```

Policy, validation, and import-normalization tests run without PostgreSQL. API integration tests are skipped unless `TEST_DB_NAME` is set. To run them, create an empty dedicated PostgreSQL database whose name ends in `_test`, different from `DB_NAME`, and set `TEST_DB_NAME` in the environment or `.env`. Optional `TEST_DB_HOST`, `TEST_DB_USER`, `TEST_DB_PASS`, and `TEST_DB_PORT` override the normal connection settings for that database. The suite creates test fixtures, tests permissions and request transitions, and removes its fixtures afterward. It never starts a database server or reads the reference JSON as database seed data.

`npm run build` writes `frontend/dist/`. `npm start` starts the backend only; host the frontend separately for production and route `/api` to Express, or set `VITE_API_URL` at build time. The backend binds loopback for local development.

## Limitations and workflow design

There is no registration/account provisioning interface, password reset, attachment handling, notification delivery, or configurable workflow editor. Authentication uses expiring JWTs in sessionStorage; deployment hardening and session revocation remain future work. Request lists are unpaginated for the small initial scope. npm audit currently reports two moderate findings in Sequelize's transitive UUID dependency. The app uses UUID v4 rather than the reported buffer-based v3/v5/v6 paths.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for proposed versioned approval rules and manager delegation, and [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md) for the original assignment. High-value purchases currently use a single approver.

## AI assistance

OpenAI Codex helped implement the application, validation, permission checks, and tests. The database configuration was simplified at the project owner's request to use separate DB_* environment variables and an externally managed PostgreSQL server. Embedded-database helpers were removed; a tracked data migration was added to import the assignment records into the configured database. Review business assumptions and application code before submission.
