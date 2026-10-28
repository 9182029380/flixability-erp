// Host (shell) on :3000 - loads the remotes at runtime from their remoteEntry.js.
// Remote URLs come from env vars (TRAINING_URL, FINANCE_URL, DASHBOARD_URL) - see tools/webpack.factory.js.
module.exports = require('../../tools/webpack.factory')({
  dir: __dirname,
  name: 'shell',
  port: 3000,
  title: 'Flixability ERP',
  publicPath: '/',
  remotes: ['training', 'finance', 'dashboard'],
});
