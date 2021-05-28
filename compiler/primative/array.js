const Template = require('../component/template.js');
const LLVM = require('../middle/llvm.js');
const TypeRef = require('../component/typeRef.js');
const TypeDef = require('../component/typedef.js');

const Primative = {
	types: require('./types.js')
};

class Template_Array extends Template {
	constructor(ctx) {
		super(ctx, null);
		this.name = "Array";
		this.instances = {};
	}

	getType (typeList, template) {
		if (typeList.length != 0) {
			return null;
		}

		// Check the two template arguments are correct
		if (!(template[0] instanceof TypeRef)) {
			return null;
		}
		if (template[1] instanceof TypeRef) {
			return null;
		}

		// Allow default size 0
		let size = 0;
		if (template[1] && template[1].instruction.type.term == "i32") {
			size = Number(template[1].instruction.name.val);
		}

		let signature = `${template[0].type.represent} x ${size}`;

		let inst = this.instances[signature];
		if (inst === undefined) {
			inst = new Array_Gen(this, template[0], size);
			inst.link();

			this.instances[signature] = inst;
		}

		return new TypeRef(0, inst);
	}

	toLLVM() {
		return new LLVM.Fragment();
	}
}

class Array_Gen extends TypeDef {
	/**
	 *
	 * @param {File} ctx
	 * @param {TypeRef} type
	 * @param {Number} length
	 */
	constructor (ctx, type, length = 0) {
		super(ctx, {
			ref: {start: null, end: null}
		}, false);

		this.name = `${type.type.name}[${length}]`;
		this.represent = length === 0 ? `${type.type.represent}` : `[${length} x ${type.type.represent}]`;
		this.length  = length;
		this.typeRef = type;
		this.size = length === 0 ? 4 : type.type.size * length;
	}

	parse () {
		// override existing
	}

	/**
	 *
	 * @param {Expr[]} opperands
	 * @param {Register} target
	 */
	getElement (opperands, target) {
		if (opperands.length != 1) {
			return null;
		}

		let preamble = opperands[0].preamble;

		let signature = `[${opperands.map( x=> x.instruction.flattern() )}]`;
		let instruction = null;
		if (this.length === 0) {
			instruction = new LLVM.GEP(
				this.typeRef.toLLVM(),
				target.toLLVM(),
				[
					opperands[0].instruction
				],
				opperands[0].ref
			);
		} else {
			instruction = new LLVM.GEP(
				new LLVM.Type(this.represent, 0),
				target.toLLVM(),
				[
					new LLVM.Argument(
						Primative.types.i32.toLLVM(),
						new LLVM.Constant("0", opperands[0].ref),
						opperands[0].ref
					),
					opperands[0].instruction
				],
				opperands[0].ref
			);
		}

		preamble.merge(opperands[0].epilog);

		return { preamble, instruction, signature, typeRef: this.typeRef };
	}

	link () {
		this.size = this.typeRef.pointer != 0 ? 4 : this.typeRef.type.size * this.length;
	}
}

module.exports = Template_Array;