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

## Environment configuration

`.env` is ignored by Git. `backend/config/env.js` loads these values; `backend/config/database.js` passes the separate database settings to Sequelize. 

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

Employees can submit purchase, leave, and overtime requests and cancel pending requests. Only the assigned approver can approve or reject a request; rejection requires a reason. HR can view company-wide leave and overtime; Finance and the director can view all request history. HR managers and the director can access the employee directory. History visibility does not override approval assignment. Decisions and activity events commit together, with row locks preventing competing decisions. The frontend provides filtering, request details, activity timelines, and responsive layouts.

## Leave and overtime approval flow

For leave and overtime, an employee's request goes directly to an active manager of that employee's department. A manager's own request goes directly to the active Plant Director. The designated person's approval is final for that request; staff requests do not subsequently escalate to the director. A reporting link to a supervisor, colleague, director, or another department's manager does not bypass the department rule. If multiple eligible authorities exist, an eligible direct reporting link resolves the assignment; otherwise ambiguity or missing/inactive authorities blocks submission with a configuration error. Director self-approval is not supported.

Run `npm run db:migrate` to apply `005-leave-overtime-routing` to pending leave/overtime assignments. Completed historical requests retain their recorded approvers and decisions. The server also checks the current department/role rule at decision time to prevent approvals through a stale or incorrect stored assignment. Within-budget purchases now follow the same department/role rule; see the purchase flow below.


## Within-budget purchase approval flow

Purchase requests from employees first go to their department manager. Managers own purchases automatically go to Finance; see the Finance review flow below. Approval by that designated person completes the request. The application is an approvals tool: departmental budgets and whether a purchase is within budget are managed outside the system. It stores the requested estimated cost but does not add budget fields, budget calculations, budget screens, or automatic amount-based routing. Additional out-of-budget rules can be specified later.

`006-purchase-routing` applies this rule to pending purchases while preserving completed historical decisions, leave, and overtime. A pending purchase whose department has no active manager becomes unassigned with a warning; it is not sent directly to the director as a fallback. New submissions without an eligible approver are blocked. Existing historical anomalies remain preserved.


## Purchase Finance review and optional director escalation

The department manager can approve a purchase as usual or choose **Approve & send to Finance**. Forwarding records the manager's approval, assigns the active Finance Manager, and keeps the request pending. Finance can approve as the final checkpoint, reject with a reason, or choose **Approve & send to Director** when director authorization is needed. Only the current approver can act; department managers retain access to their staff requests, while Finance and the director retain access through their history permissions.

Managers own purchase requests automatically go to the Finance Manager; there is no submission choice. Employees must first obtain their department managers approval. The Finance Manager cannot assign their own purchase to themselves; their normal submission goes to the director. If the Finance Manager is already the employee's department manager, they can approve the purchase or forward it to the director without a duplicate self-review.

These routes are manual approval decisions. No department budget figures, calculations, or automatic amount thresholds are added. The request's `approval_stage` tracks `initial`, `finance`, or `director`; final decision fields are set only when the request is finally approved/rejected. Each forwarding action and its note are recorded transactionally. Run `npm run db:migrate` to apply the `007-purchase-review-stage` schema extension; existing historical decisions and assignments are preserved.


The automatic manager purchase flow supersedes the earlier manager-to-director purchase rule: Manager -> Finance Manager -> Director only if Finance chooses to escalate. `008-manager-purchases-finance` moves pending initial manager purchases into Finance review and preserves completed history. Leave and overtime retain Manager -> Director.


## Request and activity history permissions

History permissions are enforced consistently for lists, search/type/status filters, request details, approval inbox visibility, and activity events:

| Viewer | Visible history |
| --- | --- |
| Employee | Their own purchases, leave and overtime |
| Department manager | Their own requests and staff requests in their department |
| Any HR department member | Own history plus company-wide leave and overtime; HR managers also see their own department staff purchases |
| Any Finance department member | All purchases, leave and overtime across departments |
| Plant Director | All history |

Department exceptions use the employee's current department membership, loaded from PostgreSQL on every authenticated request. A manager's department staff scope excludes other managers and the director. Being named as a past actor, having an arbitrary stored assignment, or having the People-directory admin flag does not bypass these rules. Broad history visibility never grants approval authority: only the current eligible approver can decide.

The Request history page defaults to visible history for managers, HR, Finance, and the director and provides a My requests switch. Ordinary employees only see My requests. Activity history follows the same visibility rules. No database migration or historical data rewrite is required for this permission change.

## AI assistance

### Tools used and for what

I used OpenAI Codex to help build the React/Vite frontend and Express/Sequelize backend, import the reference JSON into PostgreSQL, implement authentication and approval permissions, and write tests. I also used it to refine the UI and investigate issues during development.

### Where AI was most and least helpful

AI was most helpful in translating clearly defined requirements into matching frontend and backend files, implementing repetitive API and form code, and checking permissions and request transitions with tests. It was less helpful when requirements depended on visual preferences, the initial workflow assumptions and interface needed several rounds of review and correction.

### Any AI-generated output you had to significantly correct or rethink

- **Environment configuration:** I changed the initial database setup to use a separately managed PostgreSQL server configured through the root `.env`. I specified individual `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_PORT` variables, with `.env.example` as the editable template, and removed embedded-database helpers.

- **Request approval flow:** I clarified that employees need their own department manager's approval, while managers' leave and overtime requests go to the director. Managers' purchases go to Finance, and employee purchases can be forwarded by their manager to Finance, with optional director escalation. I also corrected the treatment of imported records: completed historical decisions stay as recorded, while pending requests remain reviewable.

- **UI design and color selection:** I revised the initial interface, removed unnecessary navigation and duplicate dashboard elements, and selected `#F9F7F7`, `#DBE2EF`, and `#3F72AF` as the main palette. The login page was redesigned around a centered card, and request actions were given confirmation dialogs.

- **History navigation:** I moved Visible history from the request-history page into Activity history, replacing the separate event-list view. My requests now focuses on personal submissions, while Activity history shows approved, rejected, and cancelled requests according to department and role permissions. Pending requests requiring a decision appear in the Approval inbox.
