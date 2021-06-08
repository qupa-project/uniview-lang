const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

class Template_Primative_Blank extends Template {
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

		if (signature.length != 0) {
			return false;
		}

		if (!(template[0].type.typeSystem == "linear")) {
			return false;
		}

		let type = template[0];

		let func = new Function_Instance(this, "Blank", type, signature);
		func.generate = (regs, ir_args) => {
			return {
				preamble: new LLVM.Fragment(),
				instruction: new LLVM.Alloc(
					type.toLLVM()
				),
				type: type.duplicate()
			};
		};
		func.compile();

		return func;
	}

	toLLVM() {
		return new LLVM.Fragment();
	}
}

module.exports = Template_Primative_Blank;