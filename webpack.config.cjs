//const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/main.js',
    output:  {
        filename: './public/js/build.js'
    },
    plugins: [
        /*new HtmlWebpackPlugin({
            hash: true,
            title: 'My Awesome application',
            myPageHeader: 'Hello World',
            template: './src/public/index.html',
            filename: './public/index.html'
        }),*/
        new CopyWebpackPlugin({patterns: [
            {from: 'src/public', to: 'public/'} ]
        })
    ],
    //watch: true,
}