# Architecture & code walkthrough

## 1. Why micro frontends here?

The ERP has three business areas that different people (and later different teams) own:
**Training operations**, **Finance**, and **Management reporting**. Each is its own React application with its
own build and port. A small **shell** loads them at runtime using **Webpack 5 Module Federation**.

```
                      ┌──────────────────────── Browser ────────────────────────┐
                      │  SHELL  (:3000)  layout · menu · React Router           │
                      │    ├─ /dashboard/*  ──loads──► dashboard/remoteEntry.js │ (:3003)
                      │    ├─ /training/*   ──loads──► training/remoteEntry.js  │ (:3001)
                      │    └─ /finance/*    ──loads──► finance/remoteEntry.js   │ (:3002)
                      └──────────────┬──────────────────────────────────────────┘
                                     │ fetch (JSON)
                                     ▼
                           Express API (:4000) ── services.js (all business rules) ── db.json
```

Key properties
* **Independent deploys** – rebuild only `finance` and the shell picks it up on next page load.
* **One React, one Router** – `react`, `react-dom`, `react-router-dom` are *shared singletons* (`tools/webpack.factory.js`).
* **Failure isolation** – if a remote is down the shell shows "module unavailable" for that section only.
* **Shared code** lives in `packages/shared` (API client, formatters, UI kit, generic master page). It is bundled into each app, so there is no runtime coupling beyond the REST API.
* **No shared state between MFEs.** The API is the source of truth; they only link to each other by URL
  (e.g. Training → `/finance/purchase-orders/new?trainingId=…`). This keeps the MFEs decoupled.

## 2. Repository map

```
package.json              npm workspaces + scripts (dev, build, seed, test)
tools/
  webpack.factory.js      ONE webpack config factory used by all 4 apps (Module Federation setup)
  index.template.html     HTML template
server/                   Node + Express API
  src/config.js           company profile, GST/TDS defaults
  src/db.js               JSON-file persistence (swap for a real DB)
  src/services.js         ★ all business logic (PO, invoice, payments, GST, dashboard maths)
  src/routes.js           REST endpoints → services
  src/app.js / index.js   Express app, error handling, auto-seed
  src/seed.js             demo data (fictional companies)
  src/smoke.test.js       end-to-end business-rule test
packages/shared/src       shared library (@flix/shared)
  api.js                  fetch wrapper (single place for auth headers)
  format.js               ₹ formatting (Indian digit grouping, Lakh/Cr), dates, constants
  hooks.js                useAsync (loading/error/reload)
  ui.jsx                  Card, Stat, Badge, Table, Modal, DataForm, toasts …
  MasterPage.jsx          generic list + add/edit/delete page (config-driven)
  styles.css              design tokens + print styles
apps/shell                host: App.jsx (menu, routes, lazy remotes, error boundary), bootstrap.jsx
apps/training             remote: Trainings / Trainers / Clients pages (all built on MasterPage)
apps/finance              remote: PO list/new/detail, Invoice list/new/detail, Ledger
apps/dashboard            remote: dashboard (KPI tiles + Recharts)
```

Every remote has the same three entry files:
* `webpack.config.js` – name, port, `exposes: { './App': './src/App.jsx' }`
* `src/index.js` – `import('./bootstrap')` (async boundary required by Module Federation)
* `src/bootstrap.jsx` – standalone mode only (own Router); the shell imports `./App` directly instead.

## 3. Module Federation in this project

`tools/webpack.factory.js`:
```js
new ModuleFederationPlugin({
  name,                         // global name, e.g. "finance"
  filename: 'remoteEntry.js',   // manifest the shell downloads
  exposes,                      // remotes: { './App': './src/App.jsx' }
  remotes,                      // shell: { finance: 'finance@http://localhost:3002/remoteEntry.js' }
  shared,                       // react, react-dom, react-router-dom as singletons
})
```
In the shell, `lazy(() => import('finance/App'))` triggers a network request to the finance `remoteEntry.js`.
Each remote renders `<Routes>` **relative** to the shell's `/finance/*` route, so remotes own their sub-routes.
To add a new MFE (say *Payroll*): copy `apps/finance`, change name/port, add its URL to `URLS` in the factory,
one `lazy` import + `Route` + menu link in `apps/shell/src/App.jsx`.

## 4. Domain model (server/data/db.json)

| Collection | Key fields |
|------------|-----------|
| `trainers` | name, email, PAN, GSTIN, bank (name/account/IFSC), ratePerDay |
| `clients` | name, GSTIN, **state**, contactPerson, email, paymentTermsDays |
| `trainings` | title, clientId, **trainerId**, dates, mode, days, **trainerFee** (cost), **clientFee** (billing), status |
| `purchaseOrders` | number, trainingId, trainerId, amount, gstPct, **tdsPct**, terms, sentAt |
| `poPayments` | poId, amount, date, mode, reference (UTR) |
| `invoices` | number, trainingId, clientId, amount, gstPct, **interState**, dueDate, sentAt |
| `receipts` | invoiceId, amount (cash), **tdsDeducted**, date, mode, reference |
| `outbox` | e-mail log: to, subject, text, type (PO/INVOICE), refId, status |

**Derived values are never stored** – they are recomputed from raw records on every read (`calcPO`, `calcInvoice` in `services.js`), so they cannot drift.

### Business rules (all in `server/src/services.js`)
* **Training ↔ trainer link:** a training holds `trainerId`; a PO can only be raised once a trainer is assigned; the trainer cannot be changed after a PO exists.
* **PO maths:** `subtotal = amount`, `gst = subtotal × gst%`, `tds = subtotal × tds%` (194J), **`net = subtotal + gst − tds`**. Payments may never exceed the balance.
* **PO status:** `DRAFT` (not sent) → `SENT` → `PARTIALLY_PAID` → `PAID`. Payments are only allowed after the PO has been sent.
* **Invoice GST:** client state == company state (`config.js`) → **CGST + SGST** (half each); otherwise **IGST**. The decision is frozen on the invoice at creation (`interState`).
* **Invoice status:** `DRAFT` → `SENT` → `PARTIALLY_PAID` / `OVERDUE` (due date passed and balance > 0) → `PAID`. A receipt settles `amount + tdsDeducted` (clients deduct TDS and deposit it with the tax department; you claim the credit).
* **Numbering:** `FCS/PO/2026-27/0001`, `FCS/INV/2026-27/0001` – sequential per Indian financial year (Apr–Mar).
* **Integrity:** one PO and one invoice per training; sent documents can't be deleted; trainers/clients/trainings linked to other records can't be deleted (HTTP 409 with a clear message).
* **"Send":** `deliver()` writes to the outbox and, if `SMTP_HOST` is set, sends a real e-mail through nodemailer.

### Dashboard maths (`dashboard()`)
* Revenue = sum of invoice subtotals (sent invoices only, ex-GST) · Trainer cost = sum of sent PO subtotals
* Gross margin = revenue − trainer cost · Net cash = cash collected − paid to trainers
* Receivable / overdue / payable = outstanding balances of sent invoices / sent POs
* 12-month series bucket revenue & cost by document date, cash by payment date.

## 5. REST API (base `/api`)

```
GET|POST        /trainers /clients /trainings          GET|PUT|DELETE  /:id
GET|POST        /purchase-orders                        GET|DELETE      /purchase-orders/:id
POST            /purchase-orders/:id/send               POST            /purchase-orders/:id/payments
GET|POST        /invoices                               GET|DELETE      /invoices/:id
POST            /invoices/:id/send                      POST            /invoices/:id/receipts
GET             /payments   (ledger)                    GET             /dashboard     GET /meta
```
Errors are `{ "error": "message" }` with 400 (validation), 404, 409 (conflict).

## 6. Frontend building blocks

* `MasterPage` – pass `endpoint`, `fields`, `columns` and you get search, filter, add/edit modal, delete with error toasts. Trainers, Clients and Trainings are ~40 lines each because of it.
* `DataForm` – config-driven forms (text/number/email/date/select/textarea) with inline server errors.
* `useAsync` – `{ data, loading, error, reload }`; used on every screen.
* PO / Invoice detail pages are real **printable documents**: the `@media print` rules in `styles.css` hide menus and buttons, so *Print / Save PDF* gives a clean PDF.
* `toast()` uses a window event so notifications work from any micro frontend.

## 7. Extending

| Need | Where |
|------|-------|
| Login / roles | `api.js` (token header) + auth middleware in `server/src/app.js`; guard routes in the shell |
| Real database | replace `db.js` and the array operations in `services.js` |
| PDF attachment in e-mails | generate in `services.deliver()` (e.g. pdfkit/puppeteer) |
| Credit notes, expenses, GST reports | new collections + routes; new pages in `apps/finance` |
| New dashboard widget | add to `dashboard()` in `services.js`, render in `apps/dashboard/src/App.jsx` |
