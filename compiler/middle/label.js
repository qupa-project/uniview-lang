const Instruction = require("./instruction.js");
let LLVM = require('./llvm.js');

class Label extends Instruction {
	/**
	 *
	 * @param {LLVM.ID} term
	 * @param {BNF_Reference?} ref
	 */
	constructor(name, ref) {
		super (ref);
		this.name = name;
	}

	toDefinition(ommit = false) {
		return new Label_Definition(this.name, ommit, this.ref);
	}

	flattern() {
		return `label ${this.name.flattern()}`;
	}
}

class Label_Definition extends Label {
	constructor (name, ommit = false, ref = null) {
		super(name, ref);
		this.ommit = ommit;
	}

	assign_ID (gen) {
		this.name.assign_ID(gen);
	}

	flattern() {
		return (this.ommit ? "" : "\n") + `${this.name.flattern()}:`;
	}
}

module.exports = Label;