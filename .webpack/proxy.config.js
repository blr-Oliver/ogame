const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  name: 'proxy',
  mode: 'production',
  devtool: false,
  entry: {
    proxy: {
      asyncChunks: false,
      chunkLoading: false,
      import: './src/proxy/proxy.ts'
    }
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: 'ts-loader'
    }]
  },
  externals: {
    fs: 'commonjs2 fs',
    url: 'commonjs2 url',
    connect: 'commonjs2 connect',
    'http-server': 'commonjs http-server',
    'http-mitm-proxy': 'commonjs2 http-mitm-proxy'
  },
  target: 'es6',
  output: {
    asyncChunks: false,
    chunkFormat: 'module',
    chunkLoading: false,
    clean: true,
    iife: false,
    module: true,
    path: path.resolve('./proxy'),
    filename: '[name].js'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: './src/proxy/inject.htm', to: './', force: true},
        {from: './src/proxy/proxy-config.js', to: './', force: true}
      ]
    })
  ],
  cache: false,
  experiments: {
    cacheUnaffected: false,
    outputModule: true,
    lazyCompilation: false
  },
  externalsType: 'import',
  node: {
    global: false
  },
  optimization: {
    concatenateModules: true,
    innerGraph: false,
    mangleExports: false,
    minimize: false,
    moduleIds: 'named',
    removeAvailableModules: false,
    removeEmptyChunks: true,
    splitChunks: false,
    usedExports: false
  }
};

module.exports = config;
