const Instruction = require("./instruction.js");

class Branch_Unco extends Instruction {
	/**
	 *
	 * @param {LLVM.Label} term
	 * @param {BNF_Reference?} ref
	 */
	constructor(label, ref) {
		super (ref);
		this.label = label;
	}

	flattern(indent) {
		return super.flattern(
			`br ${this.label.flattern()}`,
		indent);
	}
}
module.exports = Branch_Unco;