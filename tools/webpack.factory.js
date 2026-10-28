/**
 * One webpack config factory used by the shell and every micro frontend.
 *
 *  - Each app is an independent webpack build with its own dev server / dist folder.
 *  - Remotes (training, finance, dashboard) EXPOSE "./App" through Module Federation.
 *  - The shell (host) CONSUMES them at runtime via remoteEntry.js, so each
 *    remote can be built and deployed independently of the others.
 *  - react / react-dom / react-router-dom are shared singletons, so there is
 *    exactly one React and one Router in the page.
 *
 * Remote locations are configurable through env variables (see README) so the
 * same build works on localhost and in production.
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const { ModuleFederationPlugin } = webpack.container;

const URLS = {
  training: process.env.TRAINING_URL || 'http://localhost:3001',
  finance: process.env.FINANCE_URL || 'http://localhost:3002',
  dashboard: process.env.DASHBOARD_URL || 'http://localhost:3003',
};
const API_URL = process.env.API_URL || 'http://localhost:4000/api';

const shared = {
  react: { singleton: true, requiredVersion: '^18.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
  'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
};

module.exports = function factory({ dir, name, port, title, exposes, remotes, publicPath = 'auto' }) {
  return (env, argv) => {
    const prod = argv.mode === 'production';
    const remoteMap = {};
    (remotes || []).forEach((r) => {
      remoteMap[r] = `${r}@${URLS[r]}/remoteEntry.js`;
    });

    return {
      entry: './src/index.js',
      output: {
        path: path.resolve(dir, 'dist'),
        publicPath,
        clean: true,
        filename: prod ? '[name].[contenthash:8].js' : '[name].js',
      },
      resolve: { extensions: ['.js', '.jsx'] },
      devtool: prod ? 'source-map' : 'eval-cheap-module-source-map',
      devServer: {
        port,
        hot: true,
        historyApiFallback: true,
        headers: { 'Access-Control-Allow-Origin': '*' },
      },
      module: {
        rules: [
          {
            test: /\.jsx?$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              // Inline config: webpack runs with cwd = apps/<name>, so a root babel.config.json would NOT be found.
              options: {
                configFile: false,
                babelrc: false,
                presets: [
                  [require.resolve('@babel/preset-env'), { targets: 'defaults' }],
                  [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
                ],
              },
            },
          },
          { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
      },
      plugins: [
        new webpack.DefinePlugin({ __API_URL__: JSON.stringify(API_URL) }),
        new ModuleFederationPlugin({
          name,
          filename: 'remoteEntry.js',
          exposes: exposes || {},
          remotes: remoteMap,
          shared,
        }),
        new HtmlWebpackPlugin({ title, template: path.resolve(__dirname, 'index.template.html') }),
      ],
    };
  };
};
