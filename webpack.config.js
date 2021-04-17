const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin")
const TerserPlugin = require("terser-webpack-plugin")

module.exports = {
	watch: true,
	mode: "production",
	target: "web",
	entry: "./src/js/index.js",
	devtool: "inline-source-map",
	plugins: [
		new HtmlWebpackPlugin({
			template: "./src/index.html"
		}),
	],
	module: {
		rules: [{
				test: /\.(js|jsx)$/,
				exclude: /(node_modules)/,
				use: {
					loader: "babel-loader",
				}
		}, {
			test: /(\.glsl)$/i,
			use: "raw-loader",
		}],
	},
	resolve: {
		extensions: [".js", ".jsx", "glsl"]
	},
	output: {
		path: path.resolve(__dirname, "./dist"),
		filename: "bundle.min.js"
	},
	optimization: {
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					warnings: false,
					mangle: false
				}
			})
		]
	}
};