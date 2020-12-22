const LLVM = require('../../middle/llvm.js');
const TypeRef = require('../typeRef.js');

const Constant = require('./constant.js');
const Value = require('./value.js');

class Variable extends Value {
	/**
	 *
	 * @param {Number} id
	 * @param {TypeRef} type
	 * @param {String} name
	 * @param {Number} pointerDepth
	 * @param {BNF_Reference} ref
	 */
	constructor(type, name, ref) {
		super(type, ref);
		this.name = name;
		this.stores = [];
		this.initalised = false;
	}



	get(ast, scope) {
	}


	/**
	 * Resolves the possible states of the variable into a single LLVM argument
	 * @private
	 */
	resolve (ref) {
		switch (this.stores.length) {
			case 0:
				return {
					error: true,
					msg: this.initalised ? 
						`'${this.name}' has had it's already value used` :
						`'${this.name}' has not be initalised`,
					ref
				};
			case 1:
				return {
					preamble: new LLVM.Fragment(),
					instruction: this.stores[0]
				};
			default:
				return {
					error: true,
					msg: `Unable to handle duality of variable '${this.name}'`,
					ref
				};
		}
	}





	markUpdated(register) {
		this.stores = [register];
		this.initalised = true;
	}

	/**
	 * Read the value of a variable
	 * @param {LLVM.BNF_Reference} ref 
	 * @returns {LLVM.Argument}
	 */
	read (ref) {
		let out = this.resolve(ref);
		if (out.error) {
			return out;
		}

		if (this.type.typeSystem == 'linear') {
			this.stores = [];
		}

		out.type = this.type;
		return out;
	}
}

module.exports = Variable;