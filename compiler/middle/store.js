const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Store extends Instruction {
	/**
	 *
	 * @param {LLVM.Argument} reg
	 * @param {LLVM.Instruction} data
	 * @param {Number} width
	 * @param {BNF_Reference?} ref
	 */
	constructor(reg, data, ref) {
		super (ref);
		this.register = reg;
		this.data     = data;
	}

	flattern(indent) {
		return super.flattern(
			`store ${this.data.flattern()}, ` +
			`${this.register.flattern()}, ` +
			`align 4`,
		indent);
	}
}

module.exports = Store;