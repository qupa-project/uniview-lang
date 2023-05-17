const LLVM = {
	Type: require('./../middle/type.js')
};

class TypeRef {
	/**
	 *
	 * @param {Number} pointerLvl
	 * @param {Type} type
	 */
	constructor (type, lent = false, constant = false, local = false) {
		this.native = type.native;
		this.type = type;
		this.lent = lent;
		this.constant = constant;
		this.local = local;
	}

	getName () {
		return this.type.name || "constant";
	}

	getTerm (ast, reg, ref) {
		return this.type.getTerm(ast, reg, ref);
	}

	getElement (ast, target) {
		return this.type.getElement(ast, target);
	}

	/**
	 * Do the TypeRefs match approximately
	 * @param {TypeRef} other
	 * @returns
	 */
	weakMatch(other) {
		if (!(other instanceof TypeRef)) {
			return false;
		}

		return this.type === other.type;
	}

	/**
	 * Do the TypeRefs match including lent status
	 * @param {TypeRef} other
	 */
	match (other) {
		return this.weakMatch(other) && this.lent == other.lent &&
			this.constant == other.constant;
			// ignore local as they don't impact use for computation
	}

	matchApprox (other) {
		if (!(other instanceof TypeRef)) {
			return false;
		}

		return this.type == other.type;
	}


	/**
	 * Creates a clone of this reference
	 */
	duplicate () {
		return new TypeRef(this.type, this.lent, this.constant, this.local);
	}


	/**
	 * @returns {String}
	 */
	toString () {
		return ( this.lent ? (this.constant ? "$" : "@") : "" ) + this.type.name;
	}

	toLLVM (ref = null, flat = false, pointer = false) {
		if (flat) {
			console.warn("Flat used", new Error().stack);
		}
		if (pointer) {
			console.warn("Pointer used", new Error().stack);
		}

		return new LLVM.Type(
			this.type.represent,
			flat ? 0 :
				pointer ? 1 :
					this.lent || !this.native ? 1 : 0,
			ref
		);
	}
}

module.exports = TypeRef;