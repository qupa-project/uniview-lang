const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');


class Select extends Instruction {
	/**
	 *
	 * @param {LLVM.Argument} condition
	 * @param {LLVM.Argument[]} results
	 * @param {BNF_Reference?} ref
	 */
	constructor(condition, results, ref) {
		super (ref);
		this.condition = condition;
		this.results = results;
	}

	flattern (indent) {
		return super.flattern(
			`select ` +
			`${this.condition.flattern(0)}, ` +
			this.results.map( x => x.flattern(0) ).join(", "),
		indent);
	}
}


module.exports = Select;