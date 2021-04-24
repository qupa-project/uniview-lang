const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Primative_Size_Of extends Template {
	constructor (ctx) {
		super(ctx, null);
	}

	getFunction (access, signature, template) {
		return this.generate(access, signature, template);
	}

	generate (access, signature, template) {
		if (access.length != 0) {
			return false;
		}

		if (signature.length > 0) {
			return false;
		}

		if (template.length != 1) {
			return false;
		}

		let func = new Function_Instance(this, "sizeof", types.i32.toLLVM(), []);
		func.generate = (regs, ir_args) => {
			return {
				preamble: new LLVM.Fragment(),
				instruction: new LLVM.Argument(
					types.i32.toLLVM(),
					new LLVM.Constant(template[0].pointer > 0 ? 4 : template[0].type.size, null)
				),
				type: new TypeRef(0, types.i32)
			};
		};

		return func;
	}
}

module.exports = Template_Primative_Size_Of;