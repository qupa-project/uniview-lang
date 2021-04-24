const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');

class Type extends Instruction {
	/**
	 *
	 * @param {String} term
	 * @param {Number} pointerDepth
	 * @param {BNF_Reference?} ref
	 */
	constructor(term, pointerDepth, ref) {
		super (ref);
		this.term = term;
		this.pointer = pointerDepth;
	}

	flattern(indent) {
		let lvl = "";
		for (let i=0; i<this.pointer; i++) {
			lvl += "*";
		}

		return super.flattern(`${this.term}${lvl}`, indent);
	}
}
module.exports = Type;