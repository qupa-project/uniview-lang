const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Compare extends Instruction {
	/**
	 * @param {String} mode
	 * @param {String} condition
	 * @param {LLVM.Type} type
	 * @param {LLVM.Name} opperand_a
	 * @param {LLVM.Name} opperand_b
	 * @param {BNF_Reference?} ref
	 */
	constructor(mode, conditon, type, opperand_a, opperand_b, ref) {
		super (ref);
		this.mode = mode;
		this.cond = conditon;
		this.type = type;
		this.a = opperand_a;
		this.b = opperand_b;
	}

	flattern(indent) {
		return super.flattern(
			( this.mode == 2 ? "f" : "i" ) +
			`cmp ` +
			`${this.cond} ` +
			`${this.type.flattern()} ` +
			`${this.a.flattern()}, ` +
			`${this.b.flattern()}`,
		indent);
	}
}

module.exports = Compare;