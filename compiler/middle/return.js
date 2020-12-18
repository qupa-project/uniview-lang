const Instruction = require('./instruction.js');
const LLVM = require('./llvm.js');

class Return extends Instruction {
	/**
	 *
	 * @param {LLVM.Instruction} expr
	 * @param {BNF_Reference?} ref
	 */
	constructor (expr, ref) {
		super(ref);
		this.expr = expr;
	}

	flattern(indent) {
		return super.flattern(`ret ${this.expr.flattern()}`, indent);
	}
}

module.exports = Return;