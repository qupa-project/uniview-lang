const Instruction = require("./instruction.js");

class ID extends Instruction {
	constructor (ref) {
		super(ref);
		this.id = null;
		this.origin = true;
		this.link = null;
	}

	/**
	 * Returns a reference to the ID number
	 * @returns {ID}
	 */
	reference() {
		let out = new ID(this.ref);
		out.origin = false;
		out.link = this.origin ? this : this.link;

		return out;
	}

	/**
	 * Returns the ID number
	 * @returns {Number}
	*/
	getID () {
		return this.origin ? this.id : this.link.getID();
	}

	/**
	 * Gets the original ID point
	 * @returns {ID}
	 */
	getDefinition() {
		if (this.origin) {
			return this;
		} else {
			return this.link.getDefinition();
		}
	}

	/**
	 * Returns true if the ID numbers are equilavent (will resolve to the same number)
	 * @param {Boolean} other
	 */
	match (other) {
		if (other instanceof ID) {
			return this.getDefinition() == other.getDefinition();
		} else {
			return false;
		}
	}

	/**
	 * Assigns the ID number to this ID element
	 * @param {Generator_ID} gen the generator used to assign ID numbers
	 */
	assign_ID(gen) {
		if (this.origin) {
			this.id = gen.next();
		} else {
			this.ref.assignID(gen);
		}
	}

	/**
	 * Flattern the LLVM to a single string
	 * @returns {String}
	 */
	flattern() {
		let id = this.getID();
		return (id === null ? "err" : id).toString();
	}
}

module.exports = ID;