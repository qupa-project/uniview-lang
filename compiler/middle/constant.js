const Instruction = require("./instruction.js");

class Constant extends Instruction {
	/**
	 *
	 * @param {String} value
	 * @param {BNF_Reference?} ref
	 */
	constructor(value, ref) {
		super (ref);
		this.val = value;
	}

	flattern() {
		return `${this.val}`;
	}
}

module.exports = Constant;