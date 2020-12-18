// rebuild the syntax
require('./build.js');

const Parser = require('./parse.js');
const fs = require('fs');


console.info("Running Parse Test")
let files = fs.readdirSync("./std/").reverse().map(x => `./std/${x}`)
	.concat( fs.readdirSync("./test/").reverse().map(x => `./test/${x}`) );

for (let file of files) {
	if (file.slice(-3) != ".qp") {
		continue;
	}

	console.info(`  Parsing ${file}`);
	let data = fs.readFileSync(file, 'utf8');
	Parser(data, file);
}

console.info("Finished parse test");