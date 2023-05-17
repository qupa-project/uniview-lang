const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');


class Select extends Instruction {
	/**
	 *
	 * @param {LLVM.Argument} condition
	 * @param {LLVM.Label} baseline
	 * @param {Array[LLVM.Constant, LLVM.Label]} opts
	 * @param {BNF_Reference?} ref
	 */
	constructor(condition, baseline, opts, ref) {
		super (ref);
		this.condition = condition;
		this.baseline = baseline;
		this.opts = opts;
	}

	flattern (indent) {
		return super.flattern(
			`switch ` +
				this.condition.flattern(0) + `, ` +
				this.baseline.flattern(0) + " [" +
					this.opts.map( x => x[0].flattern(0) + ", " + x[1].flattern(0) ).join(" ") +
				"]",
		indent);
	}
}


module.exports = Select;