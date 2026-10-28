/**
 * Business-logic smoke test: master data -> training -> PO -> payments -> invoice -> receipts -> dashboard.
 * Calls the service layer directly with a temporary database file (your real data is untouched).
 */
process.env.SMTP_DISABLED = 'true';
process.env.DB_FILE = require('path').join(require('os').tmpdir(), `flix-test-${Date.now()}.json`);
const assert = require('assert');
const s = require('./services');

const fails = async (fn, status) => {
  try { await fn(); } catch (e) { assert.equal(e.status, status, e.message); return; }
  assert.fail(`expected HTTP ${status}`);
};

(async () => {
  const tr = s.createEntity('trainers', { name: 'T One', email: 't@x.com' });
  const cl = s.createEntity('clients', { name: 'C One', email: 'c@x.com', state: 'Karnataka' });
  await fails(() => s.createEntity('trainers', { name: 'no email' }), 400);

  const t = s.createEntity('trainings', { title: 'Demo', clientId: cl.id, trainerId: tr.id, startDate: '2026-10-01', endDate: '2026-10-02', trainerFee: 100000, clientFee: 150000 });
  assert.equal(t.margin, 50000);

  // PO: 100000 + 0% GST, 10% TDS -> trainer net 90000
  const po = s.createPO({ trainingId: t.id });
  assert.equal(po.status, 'DRAFT');
  assert.equal(po.net, 90000);
  await fails(() => s.payTrainer(po.id, { amount: 1000 }), 400); // must send first
  await fails(() => s.createPO({ trainingId: t.id }), 409); // duplicate
  const sent = await s.sendPO(po.id);
  assert.equal(sent.status, 'SENT');
  assert.equal(sent.emails.length, 1);
  assert.equal(s.payTrainer(po.id, { amount: 50000 }).status, 'PARTIALLY_PAID');
  await fails(() => s.payTrainer(po.id, { amount: 99999 }), 400); // overpayment
  assert.equal(s.payTrainer(po.id, { amount: 40000 }).status, 'PAID');

  // Invoice: Karnataka client vs Telangana company -> IGST 18% = 27000, total 177000
  const inv = s.createInvoice({ trainingId: t.id });
  assert.equal(inv.igst, 27000);
  assert.equal(inv.cgst, 0);
  assert.equal(inv.total, 177000);
  await s.sendInvoice(inv.id);
  const r1 = s.receivePayment(inv.id, { amount: 135000, tdsDeducted: 15000 });
  assert.equal(r1.balance, 27000);
  assert.equal(s.receivePayment(inv.id, { amount: 27000 }).status, 'PAID');

  // Same-state client -> CGST + SGST
  const cl2 = s.createEntity('clients', { name: 'Local', email: 'l@x.com', state: 'Telangana' });
  const t2 = s.createEntity('trainings', { title: 'Local', clientId: cl2.id, startDate: '2026-10-05', endDate: '2026-10-05', clientFee: 10000 });
  const inv2 = s.createInvoice({ trainingId: t2.id });
  assert.equal(inv2.cgst, 900);
  assert.equal(inv2.sgst, 900);
  await fails(() => s.createPO({ trainingId: t2.id }), 400); // no trainer assigned

  const d = s.dashboard();
  assert.equal(d.kpi.revenue, 150000); // draft invoice excluded
  assert.equal(d.kpi.trainerCost, 100000);
  assert.equal(d.kpi.grossMargin, 50000);
  assert.equal(d.kpi.receivable, 0);
  assert.equal(d.kpi.collected, 162000);
  assert.equal(d.kpi.tdsReceivable, 15000);
  assert.equal(s.ledger().length, 4);
  await fails(() => s.deleteEntity('trainers', tr.id), 409); // linked trainer
  await fails(() => s.deletePO(po.id), 409); // sent PO

  // Seed data builds without errors and dashboard computes
  require('fs').unlinkSync(process.env.DB_FILE);
  const db = require('./db');
  db.reset();
  await require('./seed').run();
  const seeded = s.dashboard();
  assert.ok(seeded.kpi.revenue > 0 && seeded.kpi.overdue > 0 && seeded.monthly.length === 12);
  console.log('All service smoke tests passed. Seed revenue:', seeded.kpi.revenue, 'receivable:', seeded.kpi.receivable);
  process.exit(0);
})().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });
