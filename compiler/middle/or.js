const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Or extends Instruction {
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

	flattern() {
		return super.flattern(
			`or ` +
			`${this.type.flattern()} ` +
			`${this.a.flattern()}, ` +
			`${this.b.flattern()}`,
		0);
	}
}

module.exports = Or;