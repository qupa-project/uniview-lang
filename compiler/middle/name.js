const Instruction = require("./instruction.js");
const ID = require('./id.js');

class Name extends Instruction {
	/**
	 *
	 * @param {LLVM.ID|String} term
	 * @param {Boolean} global
	 * @param {BNF_Reference?} ref
	 */
	constructor(term, global, ref) {
		super (ref);
		this.term = term;
		this.isGlobal = global;
	}

	assign_ID (gen) {
		if (this.term instanceof ID) {
			this.term.assign_ID(gen);
		}
	}

	flattern() {
		return `${this.isGlobal ? "@" : "%"}` +
			( this.term instanceof ID ? this.term.flattern() : this.term );
	}
}
module.exports = Name;