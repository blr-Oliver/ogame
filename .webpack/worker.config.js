const path = require('path');

const config = {
  name: 'worker',
  mode: 'development',
  devtool: 'source-map',
  entry: {
    sw: {
      asyncChunks: false,
      chunkLoading: false,
      import: './src/worker/sw.ts'
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
    chunkFormat: 'array-push',
    chunkLoading: false,
    clean: true,
    iife: false,
    path: path.resolve('./dist'), // yes, must be root
    filename: '[name].js',
    workerChunkLoading: false
  },
  experiments: {
    cacheUnaffected: false,
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
