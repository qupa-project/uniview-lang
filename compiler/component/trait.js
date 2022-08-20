const LLVM = require('../middle/llvm.js');
const Flattern = require('../parser/flattern.js');
const TypeDef = require('./typedef.js');
const TypeRef = require('./typeRef.js');


class Trait {
	constructor (ctx, ast) {
		this.name = ast.tokens[0].tokens;
		this.ast = ast;
	}

	getFunction(access, signature, template) {
		return null;
	}

	parse () {}

	link () {
		if (this.linked) {
			return;
		}

		this.linked = true;
	}

	compile () {
	}

	toLLVM() {
		return new LLVM.Fragment();
	}
}

module.exports = Trait;