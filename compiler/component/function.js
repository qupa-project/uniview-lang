const { Generator_ID } = require('./generate.js');

const Function_Instance = require('./function_instance.js');
const LLVM = require('../middle/llvm.js');


class Function {
	constructor (ctx, ast, external = false, abstract = false) {
		this.name = ast.tokens[0].tokens[1].tokens;
		this.ctx = ctx;

		this.ref = ast.ref.start;

		this.instances = [];
		this.register(ast, external, abstract);
	}

	getFileID () {
		return this.ctx.getFileID();
	}

	getFile () {
		return this.ctx.getFile();
	}

	getFunctionGroup () {
		return this;
	}

	register (ast, external = false, abstract = false) {
		this.instances.push(new Function_Instance( this, ast, external, abstract ));
	}

	registerExport () {
		if (this.instances.length > 1) {
			this.getFile().throw(`Link Error: Cannot export function ${this.name} with more than once instances`, this.ref);
			console.error(this.instances);
		}
		this.instances[0].markExport();
	}

	getFunction (variable, signature) {
		if (variable.length != 0) {
			return null;
		}

		return this.matchSignature(signature);
	}

	matchSignature (sig) {
		for (let instance of this.instances) {
			if (instance.matchSignature(sig)) {
				return instance;
			}
		}

		return null;
	}

	merge (other){
		for (let instance of this.instances) {
			if (instance.match(other.instances[0])) {
				return false;
			}
		}

		this.instances = this.instances.concat( other.instances );

		return true;
	}

	link () {
		for (let instance of this.instances) {
			instance.link();
		}

		return;
	}

	compile () {
		for (let instance of this.instances) {
			instance.compile();
		}
	}

	toLLVM() {
		let fragment = new LLVM.Fragment();

		for (let instance of this.instances) {
			let ir = instance.toLLVM();
			fragment.append(ir);
		}

		return fragment;
	}
}


module.exports = Function;