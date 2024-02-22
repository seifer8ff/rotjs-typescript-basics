const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');
const path = require('path');

module.exports = {
    entry: './src/app.ts',
    module: {
        rules: [
            // {
            //     test: /\.(png|jpg|gif)$/i,
            //     use: [
            //       {
            //         loader: 'url-loader',
            //         options: {
            //           limit: 8192,
            //         }
            //       },
            //     ],
            //    type: 'javascript/auto'
            //   },
            // {
            //   test: /\.png/,
            //   type: 'asset/resource'
            // },
            // {
            //   test: /\.json/,
            //   type: 'asset/resource'
            // },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    output: {
        filename: 'app.js',
        path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new FileManagerPlugin({
            events: {
                onStart: {
                    copy: [
                        {
                            source: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/assets'),
                            destination: path.resolve(__dirname, 'shoelace-temp/assets')
                        },
                        {
                            source: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/themes'),
                            destination: path.resolve(__dirname, 'shoelace-temp/themes')
                        },
                        {
                            source: path.resolve(__dirname, 'public/shoelace'),
                            destination: path.resolve(__dirname, 'dist/shoelace')
                        },
                    ]
                }
            }
        }),
        new HtmlWebpackPlugin({
            title: "Sim World",
            templateContent: `
        <html class="sl-theme-dark">
            <head>
                <title>Sim World</title>
                <meta name="description" content="Test project using rotjs and pixijs to build a simulated world to settle.">
                <meta charset="utf-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <meta name="description" content="Your game description goes here.">     
                <link href="shoelace/themes/dark.css" rel="stylesheet" />       
            </head>
            <body>
                <div id="uiContainer">
                    <time-control></time-control>
                    <menu-tabs></menu-tabs>
                </div>
                <div id="gameContainer">
                    <div id="canvasContainer"></div>
                    <div id="textContainer"></div>
                </div>
            </body>
        </html>
        `
        }),
        new CopyWebpackPlugin(
            {

                patterns: [
                    // {
                    //     from: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/assets'),
                    //     to: path.resolve(__dirname, 'shoelace/assets')
                    // },  
                    // {
                    //     from: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/themes'),
                    //     to: path.resolve(__dirname, 'shoelace/themes')
                    // },
                    // {
                    //     from: path.resolve(__dirname, './public/shoelace'),
                    //     to: path.resolve(__dirname, 'public/shoelace')
                    // },
                    { from: "./public", to: "public" }]
            }
        )]
};