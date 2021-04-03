const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: './dist/web.js',
  mode: 'development',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'browser'),
    libraryTarget: 'commonjs2',
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /JSONStream\/index\.js$/,
        use: 'shebang-loader',
      },
    ],
  },
  resolve: {
    fallback: {
      stream: require.resolve('stream-browserify'),
      path: require.resolve('path-browserify'),
      crypto: require.resolve('crypto-browserify'),
      url: require.resolve('url/'),
      child_process: false,
      assert: require.resolve('assert/'),
      fs: false,
      npm: false,
      zlib: require.resolve('browserify-zlib'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      os: require.resolve('os-browserify/browser'),
      constants: require.resolve('constants-browserify'),
      worker_threads: false,
      net: false,
      tls: false,
      'aws-sdk': false,
      dns: false,
      readline: false,
      'node-docker-api': false,
      prompts: false,
      buffer: require.resolve('buffer/'),
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.title': '"browser"',
    }),
    new webpack.DefinePlugin({
      'process.env': {},
      'process.argv': [],
      'process.versions': {},
      'process.versions.node': '"12"',
      process: {
        exit: '(() => {})',
        browser: true,
        versions: {},
      },
    }),
    new webpack.ProvidePlugin({
      Buffer: path.resolve(__dirname, 'buffer.js'),
    }),
  ],
}
