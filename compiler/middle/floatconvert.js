const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class FloatConvert extends Instruction {
	/**
	 * @param {String} a
	 * @param {String} b
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} target
	 * @param {BNF_Reference?} ref
	 */
	constructor(a, b, type, target, ref) {
		super (ref);
		this.a      = a;
		this.b      = b;
		this.type   = type;
		this.target = target;
	}

	flattern(indent) {
		return super.flattern(
			`${this.a}to${this.b} ` +
			`${this.target.flattern()} to ` +
			`${this.type.flattern()} `,
		indent);
	}
}

module.exports = FloatConvert;