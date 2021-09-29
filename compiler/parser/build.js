console.info("Building Syntax...");

const BNF = require('bnf-parser');
const fs = require('fs');

let data = fs.readFileSync(__dirname+'/syntax.bnf', 'utf8');

let syntax = BNF.Build(data, 'syntax.bnf');

fs.writeFileSync(__dirname+'/syntax.json', JSON.stringify(syntax));
console.info('Built Syntax');