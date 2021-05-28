const { Generator_ID } = require('./../component/generate.js');
const LLVM = require('../middle/llvm.js');


let funcIDGen = new Generator_ID();
let types = require('./types.js');

class Function_Instance {
	constructor (ctx, name, returnType, signature = []) {
		this.ctx = ctx;
		this.name = name;

		this.returnType = returnType;
		this.signature = signature;
		this.isInline = true;

		this.id = funcIDGen.next();

		this.name = name;
		this.represent = `${this.name}.${this.ctx.getFile().getID().toString(36)}.${this.id.toString(36)}`;


		this.ir = new LLVM.Procedure (
			returnType.toLLVM(),
			new LLVM.Name(this.represent, true),
			signature.map ((arg, i) => new LLVM.Argument(
				arg.toLLVM(),
				new LLVM.Name(i.toString(), false)
			)),
			"#1",
			false
		);
	}

	getFileID () {
		return this.ctx.getFileID();
	}

	getFile () {
		return this.ctx.getFile();
	}

	getFunction () {
		return this;
	}


	generate (registers, ir_args) {
		throw new Error("Unbound");
	}



	link () {}
	match (other) {}
	compile () {}

	toLLVM() {
		return this.ir;
	}
}

module.exports = Function_Instance;