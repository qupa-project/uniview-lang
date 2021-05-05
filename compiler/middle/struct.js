const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Struct extends Instruction {
	/**
	 *
	 * @param {LLVM.Name} name
	 * @param {LLVM.Type[]} terms
	 * @param {BNF_Reference?} ref
	 */
	constructor(name, terms, ref) {
		super (ref);
		this.name = name;
		this.terms = terms;
	}

	assign_ID (gen) {
		this.name.assign_ID (gen);
	}

	flattern(indent) {
		return super.flattern(
			`${this.name.flattern().slice(1)} = type { ` +
			`${this.terms.map( x => x.flattern() ).join(", ")} }`,
		indent);
	}
}
module.exports = Struct;