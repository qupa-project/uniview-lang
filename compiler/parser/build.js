console.info("Building Syntax...");

const { BNF, Compile, ParseError } = require('bnf-parser');
const fs = require('fs');

let data = fs.readFileSync(__dirname+'/syntax.bnf', 'utf8');

let syntaxTree = BNF.parse(data, false, 'program');

if (syntaxTree instanceof ParseError) {
	console.error(syntaxTree.toString());
	process.exit(1);
}

let gen = Compile(syntaxTree);
console.log(gen.terms.keys());

fs.writeFileSync(__dirname+'/syntax.json', JSON.stringify(gen.serialize()));
console.info('Built Syntax');