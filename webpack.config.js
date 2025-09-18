const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Dotenv = require('dotenv-webpack');

const path = require('path');
const outputPath = 'dist';

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    // Build entries conditionally to avoid SCSS processing in dev (sandbox lacks node-sass binaries)
    const entries = {
        // Include SCSS only for production builds to avoid node-sass in this environment
        main: isProduction
            ? [
                path.resolve(__dirname, 'src', 'main.ts'),
                path.resolve(__dirname, 'scss', 'main.scss')
              ]
            : [
                path.resolve(__dirname, 'src', 'main.ts')
              ],
        menu:  path.resolve(__dirname, 'src', 'menu.ts'),
        background: path.resolve(__dirname, 'src', 'background.ts'),
        'vehicle-gallery': path.resolve(__dirname, 'src', 'vehicle-gallery-react.tsx'),
        settings: path.resolve(__dirname, 'src', 'settings.ts'),
        customWheelOffsetWidget: path.resolve(__dirname, 'src', 'content-scripts', 'customWheelOffsetWidget.ts'),
        customWheelOffsetStoreExtractor: path.resolve(__dirname, 'src', 'content-scripts', 'customWheelOffsetStoreExtractor.ts'),
        'chat-widget': path.resolve(__dirname, 'src', 'chat-widget.ts'),
        debug: path.resolve(__dirname, 'src', 'debug.ts'),
        vehicleStorage: path.resolve(__dirname, 'src', 'utils', 'vehicleStorage.ts')
    };

    return {
        entry: entries,
        output: {
            path: path.join(__dirname, outputPath),
            filename: '[name].js',
        },
        devtool: isProduction ? false : 'source-map',
        optimization: {
            minimize: isProduction,
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.jsx', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.(sa|sc)ss$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'sass-loader'
                    ]
                },
                {
                    test: /\.(jpg|jpeg|png|gif|woff|woff2|eot|ttf|svg)$/i,
                    use: 'url-loader?limit=1024'
                }
            ],
        },
        plugins: [
            new CopyPlugin({
                patterns: [{ from: '.', to: '.', context: 'public' }]
            }),
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
            new Dotenv(),
        ]
    };
};
