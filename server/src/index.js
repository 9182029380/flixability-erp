const db = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

(async () => {
  const data = db.load();
  // First start: fill the database with demo data so the dashboard is not empty.
  // Disable with SEED=false when you want to start with a clean system.
  if (process.env.SEED !== 'false' && data.trainers.length === 0 && data.clients.length === 0) {
    await require('./seed').run();
    console.log('Seeded demo data');
  }
  createApp().listen(PORT, () => console.log(`Flixability ERP API listening on http://localhost:${PORT}/api`));
})();
