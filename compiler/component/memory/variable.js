const LLVM = require('../../middle/llvm.js');
const TypeRef = require('../typeRef.js');

const Constant = require('./constant.js');
const Value = require('./value.js');


class Probability {
	constructor (activator, register, segment, ref) {
		this.activator = activator;
		this.register = register;
		this.segment = segment;
		this.ref = ref;

		this.rel = [];
	}

	resolve() {
		// Trigger ties
		for (let act of this.rel) {
			let res = act.activate();
			if (res !== null) {
				res.msg = `Error: Unable to merge possible states due to\n  ${res.msg}`;
				return res;
			}
		}

		// Trigger main activation
		if (this.activator) {
			return this.activator.activate();
		}

		return null;
	}

	/**
	 *
	 * @param {Probablity} other
	 */
	link(other) {
		if (other.activator) {
			this.rel.push(other.activator);
		}
	}
}



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
		this.store = null;

		this.probability = null;

		this.lastUninit = null;

		this.isCorrupt = false; // Is there an invalid state tree
		this.isClone = false;
		this.hasUpdated = false;
	}


	/**
	 * Resolves the possible states of the variable into a single LLVM argument
	 * @private
	 */
	resolve (ref) {
		if (this.isCorrupt) {
			return {
				error: true,
				msg: `Unable to merge state possibility with originally undefined value`,
				ref
			};
		}

		// Resolve probability
		if (this.probability) {
			let status = this.probability.resolve();
			if (status !== null && status.error) {
				return status;
			}

			this.store = this.probability.register;
			this.probablity = null;
		}

		if (this.store === null) {
			return {
				error: true,
				msg: this.lastUninit !== null ?
					`'${this.name}' has had it's already value used` :
					`'${this.name}' has not be initalised`,
				ref
			};
		} else {
			return {
				register: this.store,
				preamble: new LLVM.Fragment()
			};
		}

		throw "Bad code path";
	}





	markUpdated(register) {
		this.store = register;
		this.lastUninit = null;
		this.hasUpdated = true;
	}

	/**
	 *
	 * @param {Possibility} other
	 */
	addPossibility(poss, segment) {
		if (this.store.length == 0){
			this.isCorrupt = true;
		}

		this.store.push(poss);
	}

	resolvePossibilities(options, segment, ref) {
		let id = new LLVM.ID();

		let instr = new LLVM.Latent(new LLVM.Set(
			new LLVM.Name(id, false, ref),
			new LLVM.Phi(this.type.toLLVM(), options.map(x => [
				x.register.name,
				new LLVM.Name(x.segment, false, ref)
			]), ref),
			ref
		));

		let prob = new Probability(
			instr,
			new LLVM.Argument(
				this.type.toLLVM(),
				new LLVM.Name(id.reference(), false, ref),
				ref
			),
			segment,
			ref
		);

		for (let opt of options) {
			prob.link(opt);
		}

		this.probability = prob;
		return instr;
	}

	isSuperPosition() {
		return this.possiblity !== null;
	}

	createProbability(segment, ref) {
		let instr = this.resolve(ref);
		let activator = null;

		if (instr.error) {
			activator = new LLVM.Latent(new LLVM.Failure(
				instr.msg, instr.ref
			), ref);
		}

		return new Probability(activator, instr.register, segment, ref);
	}


	/**
	 * Read the value of a variable
	 * @param {LLVM.BNF_Reference} ref
	 * @returns {LLVM.Argument}
	 */
	read (ref) {
		let out = this.resolve(ref);
		if (out !== null && out.error) {
			return out;
		}

		if (this.type.typeSystem == 'linear') {
			this.store = null;
			this.lastUninit = ref;
		}

		out.type = this.type;
		return out;
	}

	clone() {
		let out = new Variable(this.type, this.name, this.ref);
		out.store = this.store;
		out.isClone = true;
		out.hasUpdated = false;

		return out;
	}
}

module.exports = Variable;