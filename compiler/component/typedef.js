const { Generator_ID } = require('./generate.js');
const LLVM = require('./../middle/llvm.js');
let typeIDGen = new Generator_ID();

class TypeDef {
	constructor (ctx, ast, external = false) {
		this.ctx      = ctx;
		this.ast      = ast;
		this.ref      = ast.ref.start;
		this.external = external;

		this.primative = false;
		this.linked = false;

		this.id = typeIDGen.next();

		this.represent = "unknown";
		this.name = "unknown";
		this.size = 0;

		this.parse();
	}


	getTerm () {
		return null;
	}
	getElement () {
		return null;
	}


	parse() {
		this.name = this.ast.tokens[0].tokens;
		this.represent = this.external ? this.name : `"${this.name}@${this.ctx.getFileID().toString(36)}"`;
	}

	link() {
		this.size = Number(this.ast.tokens[1].tokens);
		this.linked = true;
		return;
	}

	compile() {
		return new LLVM.Comment(`Assume Typedef: ${this.name} ${this.represent}, ${this.size}`, this.ref);
	}

	toLLVM() {
		return new LLVM.Type(this.represent, 0, this.declared || null);
	}
}
module.exports = TypeDef;