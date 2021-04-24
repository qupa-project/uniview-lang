const Instruction = require("./instruction.js");

class Load extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type The type of data
	 * @param {LLVM.Argument} reg_address The register which holds the address of the data
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, reg_address, ref) {
		super (ref);
		this.type    = type;
		this.address = reg_address;
	}

	flattern(indent) {
		return super.flattern(
			`load ${this.type.flattern()}, ` +
			`${this.type.flattern()}* ` +
			`${this.address.flattern()}, ` +
			`align 4`,
		indent);
	}
}

module.exports = Load;