const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
entry: './src/app.ts',
module: {
    rules:[
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
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
    }]
},
resolve: {
    extensions: ['.ts', '.tsx', '.js']
},
output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist')
},
plugins: [new HtmlWebpackPlugin({
    filename: "index.html",
    template: "./index.html"
})],
mode: 'development'
};