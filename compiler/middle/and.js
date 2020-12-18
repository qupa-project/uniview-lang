const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class And extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} opperand_a
	 * @param {LLVM.Argument} opperand_b
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, opperand_a, opperand_b, ref) {
		super (ref);
		this.type = type;
		this.a = opperand_a;
		this.b = opperand_b;
	}

	flattern() {
		return super.flattern(
			`and ` +
			`${this.type.flattern()} ` +
			`${this.a.flattern()}, ` +
			`${this.b.flattern()}`,
		0);
	}
}

module.exports = And;