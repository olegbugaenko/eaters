const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const copyDirectory = async (source, destination) => {
  await fs.promises.mkdir(destination, { recursive: true });
  const entries = await fs.promises.readdir(source, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, destinationPath);
        return;
      }

      if (entry.name === 'index.html') {
        return;
      }

      await fs.promises.copyFile(sourcePath, destinationPath);
    })
  );
};

class CopyStaticAssetsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('CopyStaticAssetsPlugin', async () => {
      const outputPath = compiler.options.output.path;
      const publicPath = path.resolve(__dirname, 'public');

      if (!fs.existsSync(publicPath)) {
        return;
      }

      await copyDirectory(publicPath, outputPath);
    });
  }
}

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      publicPath: isProduction ? './' : '/',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@screens': path.resolve(__dirname, 'src/ui/screens'),
        '@ui-shared': path.resolve(__dirname, 'src/ui/shared'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@logic': path.resolve(__dirname, 'src/logic'),
        '@core': path.resolve(__dirname, 'src/core'),
        '@db': path.resolve(__dirname, 'src/db'),
        'react-joyride': path.resolve(__dirname, 'vendor/react-joyride'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
          exclude: /theme\.css$/,
        },
        {
          test: /theme\.css$/,
          use: ['style-loader', 'css-loader'],
          sideEffects: true,
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
      }),
      new CopyStaticAssetsPlugin(),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      compress: true,
      port: 3000,
      hot: true,
      client: {
        overlay: true,
      },
      historyApiFallback: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
    // Avoid eval-based source maps in dev to prevent huge retained string blobs on HMR
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
  };
};
