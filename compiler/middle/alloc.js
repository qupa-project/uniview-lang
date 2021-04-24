const Instruction = require("./instruction.js");

class Alloc extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, ref) {
		super (ref);
		this.type = type;
	}

	flattern(indent) {
		return super.flattern(`alloca ${this.type.flattern()}, align 4`, indent);
	}
}

module.exports = Alloc;