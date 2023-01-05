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
		this.represent = `${this.name}.${this.id.toString(36)}.${this.ctx.getFile().getID().toString(36)}`;

		if (returnType.native) {
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
		} else {
			this.ir = new LLVM.Procedure (
				new LLVM.Type("void", 0, null),
				new LLVM.Name(this.represent, true),
				[returnType, ...signature].map ((arg, i) => new LLVM.Argument(
					arg.toLLVM(),
					new LLVM.Name(i.toString(), false)
				)),
				"#1",
				false
			);
		}
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
	compile () {
		let gen = new Generator_ID(this.signature.length + 1);
		this.ir.assign_ID(gen);
	}

	toLLVM() {
		return this.isInline ?
			new LLVM.Fragment() :
			this.ir;
	}
}

module.exports = Function_Instance;