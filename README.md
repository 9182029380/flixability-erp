# Flixability Finance ERP — React Micro Frontends

Financial-tracking ERP for **Flixability Cloud Services Private Limited** (corporate learning & development).
It covers the whole money flow in one place:

```
Trainer + Client masters ──► Training (client + trainer + fees)
        │
        ├─► Purchase Order ─► e-mail to trainer ─► payments (TDS) ─► PO closed       (PAYABLES)
        └─► Tax Invoice (GST) ─► e-mail to client ─► receipts (TDS) ─► invoice paid  (RECEIVABLES)
                                         │
                                         ▼
                         Dashboard: revenue, cost, margin, cash, overdue
```

## 1. Quick start

Requirements: Node.js 18+ (20/22 recommended) and npm 9+.

```bash
npm install          # installs every workspace (shell, 3 micro frontends, shared lib, API)
npm run dev          # starts API + shell + 3 micro frontends together
```

Open **http://localhost:3000**. The API seeds demo data on first start (`SEED=false` to start empty,
`npm run seed` to reset to demo data).

| Process            | Port | What it is                                     |
|--------------------|------|------------------------------------------------|
| API (Express)      | 4000 | REST API + business rules, JSON-file database  |
| `apps/shell`       | 3000 | Host app: layout, menu, router                 |
| `apps/training`    | 3001 | Micro frontend: trainings, trainers, clients   |
| `apps/finance`     | 3002 | Micro frontend: POs, invoices, payments ledger |
| `apps/dashboard`   | 3003 | Micro frontend: business dashboard             |

Each micro frontend also runs **standalone** (e.g. `http://localhost:3002`) for isolated development.

```bash
npm test             # backend business-rule tests (no network, temp DB)
npm run build        # production builds -> apps/*/dist
```

## 2. How to use it (the flow)

1. **Corporate clients** – add each company (GSTIN, state, payment terms). *State decides CGST+SGST vs IGST.*
2. **Trainers** – add profile, PAN, bank details, e-mail.
3. **Trainings** – schedule a training, pick the client and trainer, set *Trainer fee* (we pay) and *Client fee* (we bill, ex-GST). Margin is shown instantly.
4. **PO to trainer** – on the training row click **Create PO** (amount, GST %, TDS % prefilled) → open the PO → **Send PO to trainer** (e-mails it; printable via *Print / Save PDF*).
5. **Pay the trainer** – on the PO click **Record payment** (full or part; UTR/mode saved). Net payable = amount + GST − TDS. Status moves Draft → Sent → Partially paid → Paid.
6. **Invoice the client** – on the training row click **Invoice** → GST split is automatic → **Send invoice to client**.
7. **Collect** – **Record receipt** with cash received and/or TDS deducted by the client. Past-due invoices turn **Overdue** automatically.
8. **Dashboard** – revenue, trainer cost, gross margin, net cash, receivables, overdue, payables, 12-month charts, top clients/trainers, upcoming trainings, recent activity.

## 3. Configuration

| What | Where |
|------|-------|
| Company name, GSTIN, PAN, state, bank details printed on documents | `server/src/config.js` |
| Default GST % (invoice 18, PO 0), TDS % (10), PO terms | `server/src/config.js` |
| Real e-mail (otherwise e-mails are logged in the document's *E-mail log*) | env: `SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS MAIL_FROM` before `npm run dev:api` |
| API port / DB file | env: `PORT`, `DB_FILE` |
| API URL used by the frontends | env at build/dev time: `API_URL` (default `http://localhost:4000/api`) |
| Where the shell finds the micro frontends | env at build/dev time: `TRAINING_URL`, `FINANCE_URL`, `DASHBOARD_URL` |

> **Replace the placeholder GSTIN/PAN/bank details in `server/src/config.js` before issuing real documents.**

## 4. Deploying

Each app is built and deployed independently:

```bash
API_URL=https://api.example.com/api npm run build -w apps/training
API_URL=https://api.example.com/api npm run build -w apps/finance
API_URL=https://api.example.com/api npm run build -w apps/dashboard
TRAINING_URL=https://training.example.com FINANCE_URL=https://finance.example.com \
DASHBOARD_URL=https://dashboard.example.com API_URL=https://api.example.com/api \
npm run build -w apps/shell
```

Upload every `dist/` to static hosting (S3+CloudFront, Netlify, Nginx…). The shell needs SPA fallback to `index.html`.
Allow cross-origin loading of `remoteEntry.js` (`Access-Control-Allow-Origin`) from the remotes' host.
Run the API with `node server/src/index.js` (behind HTTPS, with `SEED=false`).

## 5. Before production – recommended hardening

This is a complete working application, but a few things are intentionally simple:

* **No authentication/roles.** Add login (JWT/SSO) – the single place to attach tokens is `packages/shared/src/api.js`; add an auth middleware in `server/src/app.js`.
* **JSON-file database** (`server/data/db.json`). Fine for one instance; swap `server/src/db.js` + `services.js` data access for PostgreSQL/MongoDB for multi-user use.
* Bank account numbers are stored in plain text – encrypt at rest or restrict access.
* E-mails send the PO/invoice details as text; PDF attachment generation can be added in `services.deliver()`.
* GST is computed per invoice with a single rate; e-invoicing (IRN), GSTR filing and TDS return filing are out of scope.

See **docs/ARCHITECTURE.md** for a file-by-file explanation.
