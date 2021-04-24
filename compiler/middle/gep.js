const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class GEP extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} reg_address
	 * @param {LLVM.Constant[]} cnst_term
	 * @param {BNF_Reference?} ref
	 */
	constructor(type, reg_address, cnst_term, ref) {
		super (ref);
		this.type = type;
		this.address = reg_address;
		this.term = cnst_term;
	}

	flattern(indent) {
		return super.flattern(
			`getelementptr inbounds ` +
			`${this.type.flattern()}, ` +
			`${this.address.flattern()}, ` +
			`${this.term.map( x => x.flattern() ).join(', ')}`,
		indent);
	}
}

module.exports = GEP;