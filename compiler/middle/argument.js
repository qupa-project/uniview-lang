const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');
const Constant = require("./constant.js");

class Argument extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {LLVM.Name} name
	 * @param {BNF_Reference?} ref
	 * @param {String?} originalName
	 */
	constructor(type, name, ref, originalName) {
		super(ref);
		this.type   = type;
		this.name   = name;
		this.origin = originalName;
	}

	assign_ID (gen) {
		this.name.assign_ID(gen);
	}

	isConstant() {
		return this.name instanceof Constant;
	}

	flattern() {
		return `${this.type.flattern()} ${this.name.flattern()}`;
	}
}

module.exports = Argument;