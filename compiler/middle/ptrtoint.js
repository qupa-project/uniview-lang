const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class PtrToInt extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} target
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, target, ref) {
		super (ref);
		this.target = target;
		this.type   = type;
	}

	flattern() {
		return super.flattern(
			`ptrtoint ` +
			`${this.target.flattern()} to ` +
			`${this.type.flattern()}`,
		0);
	}
}

module.exports = PtrToInt;