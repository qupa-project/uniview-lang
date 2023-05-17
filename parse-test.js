const Parse = require('./compiler/parser/parse.js');
const fs = require('fs');


let file = fs.readFileSync('./test.uv', 'utf8');
Parse(file);