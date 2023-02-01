const LLVM = require('../../middle/llvm.js');
const Value = require('./value.js');

class Constant extends Value {
	constructor (type, value, ref) {
		super(type, ref);
		this.value = value;
	}

	clone () {
		return new Constant(this.type, this.value, this.ref);
	}

	/**
	 * @param {LLVM.Argument} arg
	 * @returns {Constant}
	 */
	static fromArgument (arg) {
		console.warn('Warn: Deprecated constant generation from LLVM argument');
		return new Constant(arg.type, arg.name, arg.ref);
	}

	toLLVM () {
		return new LLVM.Argument(this.type.toLLVM(), new LLVM.Constant(this.value), this.ref);
	}
}

module.exports = Constant;