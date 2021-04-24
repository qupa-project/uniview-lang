const Instruction = require("./instruction.js");

class Branch extends Instruction {
	/**
	 *
	 * @param {LLVM.Argument} condition
	 * @param {LLVM.Label} label_true
	 * @param {LLVM.Label} label_false
	 * @param {BNF_Reference?} ref
	 */
	constructor(condition, label_true, label_false, ref) {
		super (ref);
		this.condition = condition;
		this.true  = label_true;
		this.false = label_false;
	}

	flattern(indent) {
		return super.flattern(
			`br ${this.condition.flattern()}, ` +
			`${this.true.flattern()}, ` +
			`${this.false.flattern()}`,
		indent);
	}
}
module.exports = Branch;