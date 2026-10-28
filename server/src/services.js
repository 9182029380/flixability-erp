/**
 * Business logic for the Flixability ERP.
 *
 * Flow:
 *   Client + Trainer (masters) -> Training (links client, trainer, fees)
 *     -> Purchase Order to trainer -> send -> trainer payments (with TDS)
 *     -> Invoice to client (GST) -> send -> receipts from client (with TDS)
 *   Dashboard reads everything and aggregates.
 *
 * Money values are stored as plain numbers (INR, 2 decimals). Derived values
 * (totals, balances, status) are ALWAYS computed from the raw records, never
 * stored, so they can't drift out of sync.
 */
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');

/* ------------------------------ helpers ------------------------------ */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (m) => new HttpError(400, m);
const notFound = (m) => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const uid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const byDateDesc = (f) => (a, b) => (f(b) > f(a) ? 1 : f(b) < f(a) ? -1 : 0);

/** Indian financial year label, e.g. 2026-10-27 -> "2026-27" */
function fyOf(date) {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

/** Sequential document numbers per financial year: FCS/PO/2026-27/0001 */
function nextNumber(kind, date) {
  const d = db.get();
  const fy = fyOf(date);
  d.counters[kind] = d.counters[kind] || {};
  d.counters[kind][fy] = (d.counters[kind][fy] || 0) + 1;
  const prefix = kind === 'po' ? 'PO' : 'INV';
  return `FCS/${prefix}/${fy}/${String(d.counters[kind][fy]).padStart(4, '0')}`;
}

function pick(body, keys) {
  const out = {};
  keys.forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k];
  });
  return out;
}
function numeric(obj, keys) {
  keys.forEach((k) => {
    if (obj[k] === '' || obj[k] === null) obj[k] = k === 'trainerFee' || k === 'clientFee' ? 0 : null;
    else if (obj[k] !== undefined) {
      obj[k] = Number(obj[k]);
      if (Number.isNaN(obj[k])) throw bad(`${k} must be a number`);
      if (obj[k] < 0) throw bad(`${k} cannot be negative`);
    }
  });
}
function required(obj, keys) {
  keys.forEach((k) => {
    if (obj[k] === undefined || obj[k] === null || String(obj[k]).trim() === '') throw bad(`${k} is required`);
  });
}

/* ------------------------------ e-mail ------------------------------- */
/**
 * "Sends" a document. Every message is written to the outbox (visible in the UI
 * as the e-mail log). Mail goes out through Gmail SMTP unless SMTP_DISABLED=true.
 */
async function deliver({ to, subject, text, type, refId }) {
  const entry = { id: uid(), to, subject, text, type, refId, at: new Date().toISOString(), status: 'LOGGED' };
  const disabled = String(process.env.SMTP_DISABLED || '').toLowerCase() === 'true';
  const host = process.env.SMTP_HOST || cfg.mail.host;
  const user = process.env.SMTP_USER || cfg.mail.user;
  const pass = (process.env.SMTP_PASS || cfg.mail.pass || '').replace(/\s+/g, '');
  if (!disabled && host && user && pass) {
    try {
      const nodemailer = require('nodemailer');
      const tx = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || cfg.mail.port || 587),
        secure: false,
        auth: { user, pass },
      });
      const from = process.env.MAIL_FROM || `"${cfg.company.name}" <${cfg.company.email}>`;
      await tx.sendMail({ from, to, subject, text });
      entry.status = 'SENT';
    } catch (e) {
      entry.status = 'FAILED';
      entry.error = e.message;
    }
  }
  db.get().outbox.push(entry);
  return entry;
}

/* ============================== MASTERS ============================== */
const FIELDS = {
  trainers: ['name', 'email', 'phone', 'expertise', 'city', 'pan', 'gstin', 'bankName', 'accountNumber', 'ifsc', 'ratePerDay', 'notes'],
  clients: ['name', 'contactPerson', 'email', 'phone', 'gstin', 'state', 'address', 'paymentTermsDays'],
  trainings: ['title', 'clientId', 'trainerId', 'startDate', 'endDate', 'mode', 'venue', 'participants', 'days', 'trainerFee', 'clientFee', 'status', 'notes'],
};
const NUMERIC = {
  trainers: ['ratePerDay'],
  clients: ['paymentTermsDays'],
  trainings: ['participants', 'days', 'trainerFee', 'clientFee'],
};
const REQUIRED = {
  trainers: ['name', 'email'],
  clients: ['name', 'email', 'state'],
  trainings: ['title', 'clientId', 'startDate', 'endDate'],
};
const MODES = ['ONLINE', 'ONSITE', 'HYBRID'];
const TRAINING_STATUS = ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function trainerView(t) {
  const d = db.get();
  const pos = d.purchaseOrders.filter((p) => p.trainerId === t.id).map(calcPO).filter((p) => p.status !== 'DRAFT');
  return {
    ...t,
    trainingCount: d.trainings.filter((x) => x.trainerId === t.id).length,
    poTotal: r2(sum(pos, (p) => p.net)),
    paid: r2(sum(pos, (p) => p.paid)),
    outstanding: r2(sum(pos, (p) => p.balance)),
  };
}
function clientView(c) {
  const d = db.get();
  const invs = d.invoices.filter((i) => i.clientId === c.id).map(calcInvoice).filter((i) => i.status !== 'DRAFT');
  return {
    ...c,
    trainingCount: d.trainings.filter((x) => x.clientId === c.id).length,
    billed: r2(sum(invs, (i) => i.total)),
    received: r2(sum(invs, (i) => i.settled)),
    outstanding: r2(sum(invs, (i) => i.balance)),
  };
}
function trainingView(t) {
  const d = db.get();
  const po = d.purchaseOrders.find((p) => p.trainingId === t.id);
  const inv = d.invoices.find((i) => i.trainingId === t.id);
  const poC = po && calcPO(po);
  const invC = inv && calcInvoice(inv);
  return {
    ...t,
    clientName: d.clients.find((c) => c.id === t.clientId)?.name || '—',
    trainerName: d.trainers.find((x) => x.id === t.trainerId)?.name || null,
    margin: r2((t.clientFee || 0) - (t.trainerFee || 0)),
    poId: po?.id || null,
    poNumber: po?.number || null,
    poStatus: poC?.status || null,
    invoiceId: inv?.id || null,
    invoiceNumber: inv?.number || null,
    invoiceStatus: invC?.status || null,
  };
}
const VIEWS = { trainers: trainerView, clients: clientView, trainings: trainingView };

function validateTraining(t, existing) {
  const d = db.get();
  if (!d.clients.some((c) => c.id === t.clientId)) throw bad('Selected client does not exist');
  if (t.trainerId && !d.trainers.some((x) => x.id === t.trainerId)) throw bad('Selected trainer does not exist');
  if (t.endDate < t.startDate) throw bad('End date cannot be before start date');
  if (t.mode && !MODES.includes(t.mode)) throw bad('Invalid mode');
  if (t.status && !TRAINING_STATUS.includes(t.status)) throw bad('Invalid status');
  if (existing) {
    const po = d.purchaseOrders.find((p) => p.trainingId === existing.id);
    if (po && (t.trainerId || null) !== (existing.trainerId || null))
      throw conflict('A purchase order already exists for this training - the trainer cannot be changed');
  }
}

function listEntity(name) {
  const d = db.get();
  return d[name].map(VIEWS[name]).sort(byDateDesc((x) => (name === 'trainings' ? x.startDate : x.createdAt || '')));
}
function getEntity(name, id) {
  const row = db.get()[name].find((x) => x.id === id);
  if (!row) throw notFound('Not found');
  return VIEWS[name](row);
}
function createEntity(name, body) {
  const data = pick(body, FIELDS[name]);
  required(data, REQUIRED[name]);
  numeric(data, NUMERIC[name]);
  if (name === 'trainings') {
    data.mode = data.mode || 'ONLINE';
    data.status = data.status || 'PLANNED';
    data.trainerId = data.trainerId || null;
    data.trainerFee = data.trainerFee || 0;
    data.clientFee = data.clientFee || 0;
    validateTraining(data);
  }
  if (name === 'clients') data.paymentTermsDays = data.paymentTermsDays ?? 30;
  const row = { id: uid(), ...data, createdAt: new Date().toISOString() };
  db.get()[name].push(row);
  db.save();
  return VIEWS[name](row);
}
function updateEntity(name, id, body) {
  const row = db.get()[name].find((x) => x.id === id);
  if (!row) throw notFound('Not found');
  const data = pick(body, FIELDS[name]);
  numeric(data, NUMERIC[name]);
  const merged = { ...row, ...data };
  required(merged, REQUIRED[name]);
  if (name === 'trainings') {
    merged.trainerId = merged.trainerId || null;
    validateTraining(merged, row);
  }
  Object.assign(row, merged, { updatedAt: new Date().toISOString() });
  db.save();
  return VIEWS[name](row);
}
function deleteEntity(name, id) {
  const d = db.get();
  const idx = d[name].findIndex((x) => x.id === id);
  if (idx < 0) throw notFound('Not found');
  if (name === 'trainers' && d.trainings.some((t) => t.trainerId === id)) throw conflict('Trainer is linked to trainings and cannot be deleted');
  if (name === 'clients' && d.trainings.some((t) => t.clientId === id)) throw conflict('Client is linked to trainings and cannot be deleted');
  if (name === 'trainings' && (d.purchaseOrders.some((p) => p.trainingId === id) || d.invoices.some((i) => i.trainingId === id)))
    throw conflict('Training has a PO or invoice and cannot be deleted');
  d[name].splice(idx, 1);
  db.save();
  return { ok: true };
}

/* ========================= PURCHASE ORDERS =========================== */
function calcPO(po) {
  const payments = db.get().poPayments.filter((p) => p.poId === po.id);
  const subtotal = r2(po.amount);
  const gst = r2((subtotal * po.gstPct) / 100);
  const total = r2(subtotal + gst);
  const tds = r2((subtotal * po.tdsPct) / 100);
  const net = r2(total - tds); // what the trainer actually receives in total
  const paid = r2(sum(payments, (p) => p.amount));
  const balance = r2(net - paid);
  const status = paid > 0 && balance <= 0.5 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : po.sentAt ? 'SENT' : 'DRAFT';
  return { ...po, subtotal, gst, total, tds, net, paid, balance: Math.max(balance, 0), status };
}
function poView(po) {
  const d = db.get();
  const c = calcPO(po);
  const training = d.trainings.find((t) => t.id === po.trainingId);
  const trainer = d.trainers.find((t) => t.id === po.trainerId);
  const client = training && d.clients.find((x) => x.id === training.clientId);
  return {
    ...c,
    training,
    trainer,
    trainingTitle: training?.title,
    trainerName: trainer?.name,
    clientName: client?.name,
    payments: d.poPayments.filter((p) => p.poId === po.id).sort(byDateDesc((p) => p.date)),
    emails: d.outbox.filter((e) => e.refId === po.id).sort(byDateDesc((e) => e.at)),
  };
}
const listPOs = () => db.get().purchaseOrders.map(poView).sort(byDateDesc((p) => p.poDate + p.number));
function getPO(id) {
  const po = db.get().purchaseOrders.find((p) => p.id === id);
  if (!po) throw notFound('Purchase order not found');
  return poView(po);
}
function createPO(body) {
  const d = db.get();
  const training = d.trainings.find((t) => t.id === body.trainingId);
  if (!training) throw bad('Select a training');
  if (!training.trainerId) throw bad('Assign a trainer to this training before raising a PO');
  if (training.status === 'CANCELLED') throw bad('Training is cancelled');
  if (d.purchaseOrders.some((p) => p.trainingId === training.id)) throw conflict('A PO already exists for this training');
  const amount = Number(body.amount ?? training.trainerFee);
  if (!(amount > 0)) throw bad('PO amount must be greater than zero');
  const gstPct = Number(body.gstPct ?? cfg.defaults.poGstPct);
  const tdsPct = Number(body.tdsPct ?? cfg.defaults.poTdsPct);
  if ([gstPct, tdsPct].some((x) => Number.isNaN(x) || x < 0 || x > 100)) throw bad('GST/TDS % must be between 0 and 100');
  const poDate = body.poDate || today();
  const po = {
    id: uid(),
    number: nextNumber('po', poDate),
    trainingId: training.id,
    trainerId: training.trainerId,
    poDate,
    amount,
    gstPct,
    tdsPct,
    terms: body.terms || cfg.defaults.poTerms,
    sentAt: null,
    createdAt: new Date().toISOString(),
  };
  d.purchaseOrders.push(po);
  db.save();
  return poView(po);
}
async function sendPO(id) {
  const po = db.get().purchaseOrders.find((p) => p.id === id);
  if (!po) throw notFound('Purchase order not found');
  const v = poView(po);
  if (!v.trainer?.email) throw bad('Trainer has no e-mail address');
  await deliver({
    to: v.trainer.email,
    subject: `Purchase Order ${po.number} - ${v.training.title}`,
    text:
      `Dear ${v.trainer.name},\n\nPlease find purchase order ${po.number} for "${v.training.title}" ` +
      `(${v.training.startDate} to ${v.training.endDate}) for ${client2(v.total)} (TDS ${po.tdsPct}% applicable).\n\n` +
      `${po.terms}\n\nRegards,\n${cfg.company.name}`,
    type: 'PO',
    refId: po.id,
  });
  po.sentAt = po.sentAt || new Date().toISOString();
  po.lastSentAt = new Date().toISOString();
  db.save();
  return poView(po);
}
const client2 = (n) => 'INR ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function payTrainer(id, body) {
  const d = db.get();
  const po = d.purchaseOrders.find((p) => p.id === id);
  if (!po) throw notFound('Purchase order not found');
  const c = calcPO(po);
  if (!po.sentAt) throw bad('Send the PO to the trainer before recording payments');
  const amount = r2(body.amount);
  if (!(amount > 0)) throw bad('Amount must be greater than zero');
  if (amount > c.balance + 0.5) throw bad(`Amount exceeds the outstanding balance of ${client2(c.balance)}`);
  d.poPayments.push({
    id: uid(),
    poId: po.id,
    amount,
    date: body.date || today(),
    mode: body.mode || 'NEFT',
    reference: body.reference || '',
    notes: body.notes || '',
    createdAt: new Date().toISOString(),
  });
  db.save();
  return poView(po);
}
function deletePO(id) {
  const d = db.get();
  const idx = d.purchaseOrders.findIndex((p) => p.id === id);
  if (idx < 0) throw notFound('Purchase order not found');
  if (d.purchaseOrders[idx].sentAt) throw conflict('A PO that has been sent cannot be deleted');
  d.purchaseOrders.splice(idx, 1);
  db.save();
  return { ok: true };
}

/* ============================= INVOICES ============================== */
function calcInvoice(inv) {
  const receipts = db.get().receipts.filter((r) => r.invoiceId === inv.id);
  const subtotal = r2(inv.amount);
  const gst = r2((subtotal * inv.gstPct) / 100);
  const cgst = inv.interState ? 0 : r2(gst / 2);
  const sgst = inv.interState ? 0 : r2(gst - cgst);
  const igst = inv.interState ? gst : 0;
  const total = r2(subtotal + gst);
  const received = r2(sum(receipts, (r) => r.amount));
  const tdsDeducted = r2(sum(receipts, (r) => r.tdsDeducted || 0));
  const settled = r2(received + tdsDeducted); // cash + TDS the client deducted
  const balance = Math.max(r2(total - settled), 0);
  let status;
  if (!inv.sentAt) status = 'DRAFT';
  else if (balance <= 0.5) status = 'PAID';
  else if (inv.dueDate < today()) status = 'OVERDUE';
  else if (settled > 0) status = 'PARTIALLY_PAID';
  else status = 'SENT';
  return { ...inv, subtotal, gst, cgst, sgst, igst, total, received, tdsDeducted, settled, balance, status };
}
function invoiceView(inv) {
  const d = db.get();
  const c = calcInvoice(inv);
  const training = d.trainings.find((t) => t.id === inv.trainingId);
  const client = d.clients.find((x) => x.id === inv.clientId);
  return {
    ...c,
    training,
    client,
    trainingTitle: training?.title,
    clientName: client?.name,
    receipts: d.receipts.filter((r) => r.invoiceId === inv.id).sort(byDateDesc((r) => r.date)),
    emails: d.outbox.filter((e) => e.refId === inv.id).sort(byDateDesc((e) => e.at)),
  };
}
const listInvoices = () => db.get().invoices.map(invoiceView).sort(byDateDesc((i) => i.invoiceDate + i.number));
function getInvoice(id) {
  const inv = db.get().invoices.find((i) => i.id === id);
  if (!inv) throw notFound('Invoice not found');
  return invoiceView(inv);
}
function createInvoice(body) {
  const d = db.get();
  const training = d.trainings.find((t) => t.id === body.trainingId);
  if (!training) throw bad('Select a training');
  if (training.status === 'CANCELLED') throw bad('Training is cancelled');
  if (d.invoices.some((i) => i.trainingId === training.id)) throw conflict('An invoice already exists for this training');
  const client = d.clients.find((c) => c.id === training.clientId);
  const amount = Number(body.amount ?? training.clientFee);
  if (!(amount > 0)) throw bad('Invoice amount must be greater than zero');
  const gstPct = Number(body.gstPct ?? cfg.defaults.invoiceGstPct);
  if (Number.isNaN(gstPct) || gstPct < 0 || gstPct > 100) throw bad('GST % must be between 0 and 100');
  const invoiceDate = body.invoiceDate || today();
  const dueDays = Number(body.dueDays ?? client.paymentTermsDays ?? 30);
  const inv = {
    id: uid(),
    number: nextNumber('inv', invoiceDate),
    trainingId: training.id,
    clientId: client.id,
    invoiceDate,
    dueDate: addDays(invoiceDate, dueDays),
    description: body.description || `Corporate training services - ${training.title}`,
    amount,
    gstPct,
    interState: (client.state || '').toLowerCase() !== cfg.company.state.toLowerCase(),
    notes: body.notes || '',
    sentAt: null,
    createdAt: new Date().toISOString(),
  };
  d.invoices.push(inv);
  db.save();
  return invoiceView(inv);
}
async function sendInvoice(id) {
  const inv = db.get().invoices.find((i) => i.id === id);
  if (!inv) throw notFound('Invoice not found');
  const v = invoiceView(inv);
  if (!v.client?.email) throw bad('Client has no e-mail address');
  await deliver({
    to: v.client.email,
    subject: `Invoice ${inv.number} - ${v.training.title}`,
    text:
      `Dear ${v.client.contactPerson || v.client.name},\n\nPlease find invoice ${inv.number} dated ${inv.invoiceDate} ` +
      `for ${client2(v.total)} (incl. GST). Due date: ${inv.dueDate}.\n\nBank: ${cfg.company.bank.name}, A/c ${cfg.company.bank.accountNumber}, IFSC ${cfg.company.bank.ifsc}\n\n` +
      `Regards,\n${cfg.company.name}`,
    type: 'INVOICE',
    refId: inv.id,
  });
  inv.sentAt = inv.sentAt || new Date().toISOString();
  inv.lastSentAt = new Date().toISOString();
  db.save();
  return invoiceView(inv);
}
function receivePayment(id, body) {
  const d = db.get();
  const inv = d.invoices.find((i) => i.id === id);
  if (!inv) throw notFound('Invoice not found');
  if (!inv.sentAt) throw bad('Send the invoice to the client before recording receipts');
  const c = calcInvoice(inv);
  const amount = r2(body.amount || 0);
  const tds = r2(body.tdsDeducted || 0);
  if (amount < 0 || tds < 0 || amount + tds <= 0) throw bad('Enter an amount received and/or TDS deducted');
  if (amount + tds > c.balance + 0.5) throw bad(`Amount exceeds the outstanding balance of ${client2(c.balance)}`);
  d.receipts.push({
    id: uid(),
    invoiceId: inv.id,
    amount,
    tdsDeducted: tds,
    date: body.date || today(),
    mode: body.mode || 'NEFT',
    reference: body.reference || '',
    notes: body.notes || '',
    createdAt: new Date().toISOString(),
  });
  db.save();
  return invoiceView(inv);
}
function deleteInvoice(id) {
  const d = db.get();
  const idx = d.invoices.findIndex((i) => i.id === id);
  if (idx < 0) throw notFound('Invoice not found');
  if (d.invoices[idx].sentAt) throw conflict('An invoice that has been sent cannot be deleted');
  d.invoices.splice(idx, 1);
  db.save();
  return { ok: true };
}

/* ============================== LEDGER =============================== */
function ledger() {
  const d = db.get();
  const out = d.poPayments.map((p) => {
    const po = d.purchaseOrders.find((x) => x.id === p.poId);
    const trainer = po && d.trainers.find((t) => t.id === po.trainerId);
    return { id: p.id, kind: 'OUT', date: p.date, party: trainer?.name, docNumber: po?.number, docId: po?.id, amount: p.amount, tds: 0, mode: p.mode, reference: p.reference };
  });
  const inn = d.receipts.map((r) => {
    const inv = d.invoices.find((x) => x.id === r.invoiceId);
    const client = inv && d.clients.find((c) => c.id === inv.clientId);
    return { id: r.id, kind: 'IN', date: r.date, party: client?.name, docNumber: inv?.number, docId: inv?.id, amount: r.amount, tds: r.tdsDeducted || 0, mode: r.mode, reference: r.reference };
  });
  return [...out, ...inn].sort(byDateDesc((x) => x.date));
}

/* ============================= DASHBOARD ============================= */
function dashboard() {
  const d = db.get();
  const pos = d.purchaseOrders.map(calcPO).filter((p) => p.status !== 'DRAFT');
  const invs = d.invoices.map(calcInvoice).filter((i) => i.status !== 'DRAFT');
  const t = today();

  const revenue = r2(sum(invs, (i) => i.subtotal));
  const cost = r2(sum(pos, (p) => p.subtotal));
  const collected = r2(sum(d.receipts, (r) => r.amount));
  const paidOut = r2(sum(d.poPayments, (p) => p.amount));
  const kpi = {
    revenue,
    gstBilled: r2(sum(invs, (i) => i.gst)),
    billed: r2(sum(invs, (i) => i.total)),
    collected,
    tdsReceivable: r2(sum(d.receipts, (r) => r.tdsDeducted || 0)),
    receivable: r2(sum(invs, (i) => i.balance)),
    overdue: r2(sum(invs.filter((i) => i.status === 'OVERDUE'), (i) => i.balance)),
    overdueCount: invs.filter((i) => i.status === 'OVERDUE').length,
    trainerCost: cost,
    paidToTrainers: paidOut,
    payable: r2(sum(pos, (p) => p.balance)),
    tdsPayable: r2(sum(pos, (p) => p.tds)),
    grossMargin: r2(revenue - cost),
    marginPct: revenue ? r2(((revenue - cost) / revenue) * 100) : 0,
    netCash: r2(collected - paidOut),
    trainingsTotal: d.trainings.length,
    trainersTotal: d.trainers.length,
    clientsTotal: d.clients.length,
  };

  // last 12 months
  const months = [];
  const base = new Date(t + 'T00:00:00Z');
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push(m.toISOString().slice(0, 7));
  }
  const label = (k) => new Date(k + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const monthly = months.map((k) => ({
    key: k,
    label: label(k),
    revenue: r2(sum(invs.filter((i) => i.invoiceDate.startsWith(k)), (i) => i.subtotal)),
    cost: r2(sum(pos.filter((p) => p.poDate.startsWith(k)), (p) => p.subtotal)),
    collected: r2(sum(d.receipts.filter((r) => r.date.startsWith(k)), (r) => r.amount)),
    paid: r2(sum(d.poPayments.filter((p) => p.date.startsWith(k)), (p) => p.amount)),
  }));

  const group = (rows, keyFn, nameFn, valFn) => {
    const m = new Map();
    rows.forEach((r) => m.set(keyFn(r), (m.get(keyFn(r)) || 0) + valFn(r)));
    return [...m.entries()].map(([k, v]) => ({ id: k, name: nameFn(k), value: r2(v) })).sort((a, b) => b.value - a.value).slice(0, 5);
  };
  const topClients = group(invs, (i) => i.clientId, (k) => d.clients.find((c) => c.id === k)?.name || '—', (i) => i.subtotal);
  const topTrainers = group(pos, (p) => p.trainerId, (k) => d.trainers.find((c) => c.id === k)?.name || '—', (p) => p.subtotal);

  const count = (rows, keys) => keys.map((k) => ({ status: k, count: rows.filter((r) => r.status === k).length, amount: r2(sum(rows.filter((r) => r.status === k), (r) => r.balance ?? 0)) }));
  const invoiceStatus = count(invs, ['SENT', 'PARTIALLY_PAID', 'OVERDUE', 'PAID']);
  const poStatus = count(pos, ['SENT', 'PARTIALLY_PAID', 'PAID']);

  const upcoming = d.trainings
    .filter((x) => x.status !== 'CANCELLED' && x.endDate >= t)
    .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
    .slice(0, 5)
    .map(trainingView);

  const activity = [
    ...d.receipts.map((r) => {
      const inv = d.invoices.find((i) => i.id === r.invoiceId);
      return { at: r.date, type: 'IN', text: `Received ${client2(r.amount + (r.tdsDeducted || 0))} against ${inv?.number}`, amount: r.amount };
    }),
    ...d.poPayments.map((p) => {
      const po = d.purchaseOrders.find((x) => x.id === p.poId);
      return { at: p.date, type: 'OUT', text: `Paid ${client2(p.amount)} against ${po?.number}`, amount: p.amount };
    }),
    ...d.outbox.map((e) => ({ at: e.at.slice(0, 10), type: 'MAIL', text: `${e.type === 'PO' ? 'PO' : 'Invoice'} e-mailed to ${e.to}`, amount: 0 })),
  ]
    .sort(byDateDesc((x) => x.at))
    .slice(0, 8);

  return { kpi, monthly, topClients, topTrainers, invoiceStatus, poStatus, upcoming, activity, generatedAt: new Date().toISOString() };
}

module.exports = {
  HttpError, today, addDays,
  listEntity, getEntity, createEntity, updateEntity, deleteEntity,
  listPOs, getPO, createPO, sendPO, payTrainer, deletePO,
  listInvoices, getInvoice, createInvoice, sendInvoice, receivePayment, deleteInvoice,
  ledger, dashboard,
  meta: () => ({ company: cfg.company, defaults: cfg.defaults }),
};
