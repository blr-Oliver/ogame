// const webpack = require('webpack');
const proxyConfig = require('./.webpack/proxy.config.js');
const workerConfig = require('./.webpack/worker.config.js');
const browserConfig = require('./.webpack/browser.config.js');
const terminalConfig = require('./.webpack/terminal.config.js');

const config = [
  // proxyConfig,
  workerConfig,
  browserConfig,
  terminalConfig
];

module.exports = config;
