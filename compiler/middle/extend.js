const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Extend extends Instruction {
	/**
	 *
	 * @param {String} mode
	 * @param {LLVM.Type} type
	 * @param {LLVM.Argument} target
	 * @param {BNF_Reference?} ref
	 */
	constructor(mode, type, target, ref) {
		super (ref);
		this.mode   = mode;
		this.type   = type;
		this.target = target;
	}

	flattern(indent) {
		return super.flattern(
			( this.mode == 2 ? "f" : ( this.mode == 1 ? "s" : "z" ) ) +
			`ext ` +
			`${this.target.flattern()} to ` +
			`${this.type.flattern()} `,
		indent);
	}
}

module.exports = Extend;