const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Trunc extends Instruction {
	/**
	 * @param {String} mode
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} target
	 * @param {BNF_Reference?} ref
	 */
	constructor(mode, type, target, ref) {
		super (ref);
		this.mode   = mode;
		this.target = target;
		this.type   = type;
	}

	flattern() {
		return super.flattern(
			( this.mode == 2 ? "fp" : "" ) +
			`trunc ` +
			`${this.target.flattern()} to ` +
			`${this.type.flattern()}`,
		0);
	}
}

module.exports = Trunc;