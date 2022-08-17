const Getopt = require('node-getopt');
const path = require('path');
const fs = require('fs');


const env_path = path.resolve(__dirname, "../.env");
let config = require('dotenv').config({path: env_path}).parsed;

function UpdateEnv(delta) {
	for (key in delta) {
		config[key] = delta[key];
	}

	fs.writeFileSync(
		env_path,
		Object.entries(config).map(([k, v]) => `${k}="${v}"`).join("\n")
	);
}


if (process.argv[1] == __filename) {
	let getopt = new Getopt([
		['', 'uvc_tool=ARG', 'the path to the prebuilt UVC tool']
	]).bindHelp();
	let opt = getopt.parse(process.argv.slice(2));

	if (opt.argv.length > 0) {
		console.warn(`Warn: Unexpected argument values ${opt.argv.map(x => `"${x}"`).join(", ")}`);
	}

	UpdateEnv(opt.options);
}


module.exports = {UpdateEnv};