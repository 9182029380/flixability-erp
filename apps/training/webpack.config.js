// Remote micro frontend "training" - runs standalone on :3001 and exposes ./App to the shell.
module.exports = require('../../tools/webpack.factory')({
  dir: __dirname,
  name: 'training',
  port: 3001,
  title: 'Flixability ERP - Training MFE',
  exposes: { './App': './src/App.jsx' },
});
