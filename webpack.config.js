// const webpack = require('webpack');
const proxyConfig = require('./.webpack/proxy.config.js');
const workerConfig = require('./.webpack/worker.config.js');

const config = [
//  proxyConfig,
  workerConfig
];

module.exports = config;
