const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Sub extends Instruction {
	/**
	 * @param {String} mode
	 * @param {LLVM.Type} type
	 * @param {LLVM.Name} opperand_a
	 * @param {LLVM.Name} opperand_b
	 * @param {BNF_Reference?} ref
	 */
	constructor(mode, type, opperand_a, opperand_b, ref) {
		super (ref);
		this.mode = mode;
		this.type = type;
		this.a = opperand_a;
		this.b = opperand_b;
	}

	flattern(indent) {
		return super.flattern(
			( this.mode == 2 ? "f" : "" ) +
			`sub ` +
			`${this.type.flattern()} ` +
			`${this.a.flattern()}, ` +
			`${this.b.flattern()}`,
		indent);
	}
}

module.exports = Sub;