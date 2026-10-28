// Remote micro frontend "dashboard" - runs standalone on :3003 and exposes ./App to the shell.
module.exports = require('../../tools/webpack.factory')({
  dir: __dirname,
  name: 'dashboard',
  port: 3003,
  title: 'Flixability ERP - Dashboard MFE',
  exposes: { './App': './src/App.jsx' },
});
