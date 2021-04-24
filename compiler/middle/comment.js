const Instruction = require('./instruction.js');

class Comment extends Instruction {
	/**
	 *
	 * @param {String} text
	 * @param {BNF_Reference?} ref
	 */
	constructor (text, ref) {
		super(ref);
		this.text = text;
	}

	flattern(indent) {
		return super.flattern(`; ${this.text}`, indent);
	}
}

module.exports = Comment;