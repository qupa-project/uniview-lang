const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Primative_Static_Cast extends Template {
	constructor(ctx) {
		super(ctx, null);
	}

	getFunction(access, signature, template) {
		return this.generate(access, signature, template);
	}

	generate(access, signature, template) {
		if (access.length != 0) {
			return false;
		}

		// Check input lengths are correct
		if (signature.length != 1|| template.length != 1) {
			return false;
		}

		// Constants are not able to be casted
		if (!(signature[0] instanceof TypeRef) || !(template[0] instanceof TypeRef)) {
			return false;
		}

		let func = new Function_Instance(this, "static_cast", template[0].toLLVM(), signature);

		// Is this an address cast or a value cast?
		if (signature[0].pointer == 0 || template[0].pointer == 0) {
			// Invalid value cast as one value is a pointer
			if (signature[0].pointer != template[0].pointer) {
				return false;
			}

			// If both values are primatives
			if (types[signature[0].type.represent] && types[template[0].type.represent]) {
				// Same type of data
				if (signature[0].type.cat == template[0].type.cat) {
					let mode = signature[0].type.cat == "float" ? 2 :
						signature[0].type.signed ? 1 : 0;

					let action = signature[0].type.size < template[0].type.size ? "Extend" : "Trunc";

					func.generate = (regs, ir_args) => {
						return {
							preamble: new LLVM.Fragment(),
							instruction: new LLVM[action](
								mode,
								template[0].toLLVM(),
								ir_args[0],
								null
							),
							type: template[0]
						}
					}
				} else {
					let a = signature[0].type.cat == "float" ? "fp" :
						signature[0].type.signed ? "si" : "ui";
					let b = template[0].type.cat == "float" ? "fp" :
					template[0].type.signed ? "si" : "ui";

					func.generate = (regs, ir_args) => {
						return {
							preamble: new LLVM.Fragment(),
							instruction: new LLVM.FloatConvert(
								a, b,
								template[0].toLLVM(),
								ir_args[0],
								null
							),
							type: template[0]
						}
					}
				}

			} else {
				return false;
			}
		} else {
			// Address cast
			func.generate = (regs, ir_args) => {
				return {
					preamble: new LLVM.Fragment(),
					instruction: new LLVM.Bitcast(
						template[0].toLLVM(),
						ir_args[0],
						null
					),
					type: template[0]
				};
			};
		}

		return func;
	}
}

module.exports = Template_Primative_Static_Cast;