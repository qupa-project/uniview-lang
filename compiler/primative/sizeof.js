const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Primative_Size_Of extends Template {
	constructor (ctx) {
		super(ctx, null);

		this.children = [];
	}

	findMatch(inputType) {
		for (let child of this.children) {
			if (child.type.match(inputType)) {
				return child.function;
			}
		}

		return null;
	}

	getFunction (access, signature, template) {
		if (access.length !== 0) {
			return false;
		}

		// Check input lengths are correct
		if (signature.length != 0 || template.length != 1) {
			return false;
		}

		let inputType = template[0];
		let outputType = new TypeRef(0, types.u64);
		let match = this.findMatch(inputType);
		if (match) {
			return match;
		}

		let func = this.generate(inputType, outputType);
		if (func) {
			this.children.push({
				type: inputType,
				function: func
			});

			return func;
		}

		return false;
	}

	generate (inputType, outputType) {

		let func = new Function_Instance(this, "sizeof", outputType, []);
		func.isInline = false;

		func.ir.append(new LLVM.Return(
			new LLVM.Argument(
				outputType.toLLVM(),
				new LLVM.Constant(inputType.pointer > 0 ? 8 : inputType.type.getSize(), null)
			)
		));

		func.compile();

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

module.exports = Template_Primative_Size_Of;