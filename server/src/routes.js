const express = require('express');
const s = require('./services');

const router = express.Router();

/** Wraps a handler so thrown errors reach the error middleware and results become JSON. */
const wrap = (fn, status = 200) => (req, res, next) =>
  Promise.resolve(fn(req, res)).then((out) => res.status(status).json(out)).catch(next);

router.get('/health', (req, res) => res.json({ ok: true }));
router.get('/meta', wrap(() => s.meta()));

// Masters + trainings: /trainers, /clients, /trainings
['trainers', 'clients', 'trainings'].forEach((name) => {
  router.get(`/${name}`, wrap(() => s.listEntity(name)));
  router.get(`/${name}/:id`, wrap((req) => s.getEntity(name, req.params.id)));
  router.post(`/${name}`, wrap((req) => s.createEntity(name, req.body), 201));
  router.put(`/${name}/:id`, wrap((req) => s.updateEntity(name, req.params.id, req.body)));
  router.delete(`/${name}/:id`, wrap((req) => s.deleteEntity(name, req.params.id)));
});

// Purchase orders (to trainers)
router.get('/purchase-orders', wrap(() => s.listPOs()));
router.get('/purchase-orders/:id', wrap((req) => s.getPO(req.params.id)));
router.post('/purchase-orders', wrap((req) => s.createPO(req.body), 201));
router.post('/purchase-orders/:id/send', wrap((req) => s.sendPO(req.params.id)));
router.post('/purchase-orders/:id/payments', wrap((req) => s.payTrainer(req.params.id, req.body), 201));
router.delete('/purchase-orders/:id', wrap((req) => s.deletePO(req.params.id)));

// Invoices (to corporate clients)
router.get('/invoices', wrap(() => s.listInvoices()));
router.get('/invoices/:id', wrap((req) => s.getInvoice(req.params.id)));
router.post('/invoices', wrap((req) => s.createInvoice(req.body), 201));
router.post('/invoices/:id/send', wrap((req) => s.sendInvoice(req.params.id)));
router.post('/invoices/:id/receipts', wrap((req) => s.receivePayment(req.params.id, req.body), 201));
router.delete('/invoices/:id', wrap((req) => s.deleteInvoice(req.params.id)));

// Combined money-in / money-out ledger and the dashboard aggregates
router.get('/payments', wrap(() => s.ledger()));
router.get('/dashboard', wrap(() => s.dashboard()));

module.exports = router;
