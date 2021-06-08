const LLVM = require("../middle/llvm.js");

class Template {
	constructor(ctx, ast) {
		this.ctx = ctx;

		this.name = "Unknown";
		this.instances = {};
	}

	getType () {
		return null;
	}
	getFunction () {
		return null;
	}

	getFile () {
		return this.ctx.getFile();
	}

	merge (other) {
		return false;
	}

	link () {
		return;
	}

	compile (){
		return new LLVM.Fragment();
	}
}

module.exports = Template;