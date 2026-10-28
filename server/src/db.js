/**
 * Tiny JSON-file database. Good enough for a single-instance internal tool and
 * keeps the project dependency-free. Swap this module for PostgreSQL/MongoDB
 * later - the rest of the code only uses get() and save().
 */
const fs = require('fs');
const path = require('path');

const FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

const empty = () => ({
  trainers: [],
  clients: [],
  trainings: [],
  purchaseOrders: [],
  poPayments: [],
  invoices: [],
  receipts: [],
  outbox: [],
  counters: { po: {}, inv: {} },
});

let db = null;

function load() {
  if (!fs.existsSync(FILE)) {
    db = empty();
    save();
  } else {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  }
  return db;
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
}

module.exports = {
  FILE,
  empty,
  load,
  save,
  get: () => db || load(),
  reset: () => {
    db = empty();
    save();
    return db;
  },
};
