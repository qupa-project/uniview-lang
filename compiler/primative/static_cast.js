const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Primative_Static_Cast extends Template {
	constructor (ctx) {
		super(ctx, null);

		this.children = [];
	}

	findMatch(inputType, outputType) {
		for (let child of this.children) {
			if (child.input == inputType && child.output == outputType) {
				return child.function;
			}
		}

		return null;
	}

	getFunction (access, signature, template) {
		// Check input lengths are correct
		if (signature.length != 1 || template.length != 1) {
			return false;
		}

		let inputType = signature[0];
		let outputType = template[0];
		let match = this.findMatch(inputType, outputType);
		if (match) {
			return match;
		}

		let func = this.generate(inputType, outputType, template);
		if (func) {
			this.children.push({
				input: inputType,
				output: outputType,
				function: func
			});

			return func;
		}

		return false;
	}

	generate (inputType, outputType) {
		let func = new Function_Instance(this, "static_cast", outputType, [inputType]);
		func.isInline = false;

		// Invalid value cast as one value is a pointer
		if (inputType.pointer != outputType.pointer) {
			return false;
		}

		// If both types are primaives
		if (types[inputType.type.name] && types[outputType.type.name]) {
			// Same type of data (i.e. float float, or int int)
			if (inputType.type.cat == outputType.type.cat) {
				let mode = inputType.type.cat == "float" ? 2 :
				inputType.type.signed ? 1 : 0;

				let action = inputType.type.size < outputType.type.size ? "Extend" : "Trunc";

				let temp = new LLVM.ID();
				func.ir.append(new LLVM.Set(
					new LLVM.Name(temp, false),
					new LLVM[action](
						mode,
						outputType.toLLVM(),
						new LLVM.Argument(
							inputType.toLLVM(),
							new LLVM.Name("0", false)
						),
						null
					)
				));
				func.ir.append(new LLVM.Return(
					new LLVM.Argument(
						outputType.toLLVM(),
						new LLVM.Name(temp.reference(), false)
					)
				));
			} else {
				let a = inputType.type.cat == "float" ? "fp" :
				inputType.type.signed ? "si" : "ui";
				let b = outputType.type.cat == "float" ? "fp" :
				outputType.type.signed ? "si" : "ui";

				let temp = new LLVM.ID();
				func.ir.append(new LLVM.Set(
					new LLVM.Name(temp, false),
					new LLVM.FloatConvert(
						a, b,
						outputType.toLLVM(),
						new LLVM.Argument(
							inputType.toLLVM(),
							new LLVM.Name("0", false)
						),
						null
					)
				));
				func.ir.append(new LLVM.Return(
					new LLVM.Argument(
						outputType.toLLVM(),
						new LLVM.Name(temp.reference(), false)
					)
				));
			}
		} else {
			return false;
		}

		return func;
	}


	toLLVM () {
		let frag = new LLVM.Fragment();

		for (let child of this.children) {
			let asm = child.function.toLLVM();
			frag.append(asm);
		}

		return frag;
	}
}

module.exports = Template_Primative_Static_Cast;