const llvm = require("../../middle/llvm");

const LLVM = require('../../middle/llvm.js');

class Value {
	/**
	 *
	 * @param {TypeRef} type
	 * @param {*} ref
	 */
	constructor (type, ref) {
		this.type = type;
		this.ref  = ref;
	}

	get () {
		return {
			error: true,
			msg: `Value Error: Cannot dereference a constant value`,
			ref
		};
	}

	deref () {
		return null;
	}

	toLLVM () {
		return new LLVM.Type("void");
	}
}


module.exports = Value;