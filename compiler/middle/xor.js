const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class XOr extends Instruction {
	/**
	 * @param {LLVM.Type} type
	 * @param {LLVM.Name} opperand_a
	 * @param {LLVM.Name} opperand_b
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, opperand_a, opperand_b, ref) {
		super (ref);
		this.type = type;
		this.a = opperand_a;
		this.b = opperand_b;
	}

	flattern(indent) {
		return super.flattern(
			`xor ` +
			`${this.type.flattern()} ` +
			`${this.a.flattern()}, ` +
			`${this.b.flattern()}`,
		indent);
	}
}

module.exports = XOr;