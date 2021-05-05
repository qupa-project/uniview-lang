const Flattern = require("../parser/flattern");
const LLVM = {
	Type: require('./../middle/type.js')
};

class TypeRef {
	/**
	 *
	 * @param {Number} pointerLvl
	 * @param {Type} type
	 */
	constructor (pointerLvl, type, lent = false) {
		this.pointer = pointerLvl;
		this.type = type;
		this.lent = lent;
	}

	getName () {
		return this.type.name || constant;
	}

	getTerm (ast, reg) {
		return this.type.getTerm(ast, reg);
	}

	getElement (ast, target) {
		return this.type.getElement(ast, target);
	}

	/**
	 *
	 * @param {TypeRef} other
	 */
	match (other) {
		if (!(other instanceof TypeRef)) {
			return false;
		}

		return this.pointer == other.pointer &&
			this.type == other.type &&
			this.lent == other.lent;
	}

	/**
	 * Increases/decreases the pointer reference level
	 * @param {Number} inc
	 */
	offsetPointer (inc) {
		this.pointer += inc;
		return this;
	}


	/**
	 * Creates a clone of this reference
	 */
	duplicate () {
		return new TypeRef(this.pointer, this.type, this.lent);
	}


	/**
	 * @returns {String}
	 */
	toString () {
		return ( this.lent ? "@" : "$" ) + this.type.name;
	}

	toLLVM (ref = null) {
		return new LLVM.Type(this.type.represent, this.pointer, ref);
	}
}

module.exports = TypeRef;