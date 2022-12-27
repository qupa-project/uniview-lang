const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Primative_Printf extends Template {
	constructor (ctx) {
		super(ctx, null);

		this.func = new Function_Instance(this, "printf", types.i32, []);
		this.func.generate = (regs, ir_args) => {
			return {
				preamble: new LLVM.Fragment(),
				instruction: new LLVM.Call(
					new LLVM.Type("i32 (i8*, ...)", 0),
					new LLVM.Name("printf", true),
					ir_args
				),
				type: new TypeRef(types.i32)
			};
		};
		this.func.compile();
	}

	getFunction (access, signature) {
		if (access.length != 0) {
			return false;
		}

		if (signature.length < 2) {
			return false;
		}

		if (signature[0].type != types.cstring) {
			return false;
		}

		if (signature
			.map(x => !x.type.native && x.type.name != "cstring")
			.reduce((state, curr) => state || curr, false)
		) {
			return false;
		}

		return this.func;
	}

	toLLVM() {
		let frag = new LLVM.Fragment();
		frag.append(new LLVM.Raw("declare dso_local i32 @printf(i8*, ...)"));
		return frag;
	}
}

module.exports = Template_Primative_Printf;