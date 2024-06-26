const path = require('path');

const config = {
  name: 'browser',
  mode: 'development',
  devtool: 'source-map',
  entry: {
    bootstrap: {
      asyncChunks: false,
      chunkLoading: false,
      import: './src/browser/bootstrap.ts'
    }
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: 'ts-loader'
    }]
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  target: 'es6',
  output: {
    asyncChunks: false,
    chunkFormat: 'module',
    clean: false,
    iife: false,
    path: path.resolve('./dist/browser'),
    filename: '[name].js'
  },
  experiments: {
    cacheUnaffected: false,
    outputModule: true,
    lazyCompilation: false
  },
  optimization: {
    concatenateModules: true,
    innerGraph: true,
    mangleExports: false,
    minimize: false,
    moduleIds: 'named',
    removeAvailableModules: false,
    removeEmptyChunks: true,
    splitChunks: false,
    usedExports: true
  }
};

module.exports = config;
