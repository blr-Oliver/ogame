const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = {
  name: 'terminal',
  mode: 'development',
  devtool: 'source-map',
  entry: {
    terminal: {
      asyncChunks: false,
      chunkLoading: false,
      import: './src/terminal/terminal.ts'
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
    path: path.resolve('./dist/terminal'),
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
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'OGame Terminal',
      template: 'src/terminal/index.html'
    })
  ]
};

module.exports = config;
