// Remote micro frontend "finance" - runs standalone on :3002 and exposes ./App to the shell.
module.exports = require('../../tools/webpack.factory')({
  dir: __dirname,
  name: 'finance',
  port: 3002,
  title: 'Flixability ERP - Finance MFE',
  exposes: { './App': './src/App.jsx' },
});
