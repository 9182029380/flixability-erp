const express = require('express');
const cors = require('cors');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', routes);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Server error' });
  });
  return app;
}

module.exports = { createApp };
