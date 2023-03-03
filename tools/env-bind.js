const path = require('path');
const fs = require('fs');


const env_path = path.resolve(__dirname, "../.env");
let config = require('dotenv').config({path: env_path}).parsed;

function UpdateEnv(delta) {
	if (config === undefined) {
		config = delta;
	} else {
		for (key in delta) {
			config[key] = delta[key];
		}
	}

	fs.writeFileSync(
		env_path,
		Object.entries(config)
			.map(([k, v]) => `${k}="${v}"`)
			.join("\n")
	);
}


if (process.argv[1] == __filename) {
	// Read in all arguments
	let updates = {};
	for (let arg of process.argv.slice(2)) {
		if (arg.indexOf("--") != 0) {
			console.warn(`Warn: Invalid argument ${arg}`);
			continue;
		}
		arg = arg.slice(2);

		let terms = arg.split("=");
		if (!terms[1]) {
			terms[1] = "true"
		}
		updates[terms[0]] = terms[1];
	}

	UpdateEnv(updates);

	console.log(`Env Updated: ${Object.keys(updates).join(", ")}`)
}


module.exports = {UpdateEnv};