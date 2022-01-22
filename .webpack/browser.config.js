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
    },
    page: {
      import: './src/browser/page.ts'
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
    clean: true,
    iife: false,
    path: path.resolve('./dist/browser'), // yes, must be root
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
