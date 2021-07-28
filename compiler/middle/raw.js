class Raw {
	/**
	 *
	 * @param {String} text
	 */
	constructor (text) {
		this.text = text;
	}

	assign_ID () {
		return;
	}

	flattern(indent) {
		return " ".repeat(indent) + this.text;
	}
}

module.exports = Raw;