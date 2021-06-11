const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: ['./src/index.tsx'],
    output: {
        path: path.resolve(__dirname, "dist")
    },
    stats: {
        errorDetails: true,
    },
    module: {
        rules: [
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/,
                type: 'asset/resource'
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: ['ts-loader'],
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                "targets": "defaults",
                                "forceAllTransforms": true
                            }],
                            "@babel/preset-react"
                        ],
                        plugins: ["@emotion"]
                    }
                },
            },
            {
                test: /\.s?css$/,
                use: [
                    "style-loader",
                    "css-loader",
                    "sass-loader",
                ],
            }
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        modules: [path.resolve(__dirname, 'src'), "node_modules"]
    },
    devServer: {
        open: true,
        contentBase: [path.join(__dirname, 'dist')],
        liveReload: true,
        compress: true,
        writeToDisk: true,
        watchContentBase: true,
        hot: true,
        port: 8080
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Sindarin Compiler",
            template: "./src/index.html"
        }),
        new CopyPlugin({
            patterns: [
                { from: path.join(__dirname, 'data'), to: path.join(__dirname, 'dist/data') },
            ],
        }),
        new MonacoWebpackPlugin()
    ]
}