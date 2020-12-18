const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Set extends Instruction {
	/**
	 *
	 * @param {LLVM.Name} register
	 * @param {LLVM.Type} type
	 * @param {BNF_Reference?} ref
	 */
	constructor(name, expr, ref) {
		super (ref);
		this.register = name;
		this.expr = expr;
	}

	assign_ID (gen) {
		this.register.assign_ID(gen);
	}

	flattern(indent) {
		return super.flattern(
			`${this.register.flattern()} = ` +
			`${this.expr.flattern()}`,
		indent);
	}
}

module.exports = Set;