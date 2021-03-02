const LLVM = require('../../middle/llvm.js');
const Structure = require('../struct.js');
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

	resolve(ref) {
		// Trigger ties
		for (let act of this.rel) {
			let res = act.activate();
			if (res !== null) {
				res.msg = `Error: Unable to merge possible states at ${ref.start.toString()} due to\n  ${res.msg}`;
				res.ref.end = ref.end;
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
		this.decomposed = false;

		this.lastUninit = ref;

		this.isCorrupt = false; // Is there an invalid state tree
		this.isClone = false;
		this.hasUpdated = false;

		this.elements = new Map();
	}


	isSuperPosition() {
		return this.possiblity !== null;
	}

	isDecomposable(ref) {
		if (this.decomposed) {
			return {
				error: true,
				msg: "Cannot decompose a decomposed value",
				ref: ref
			};
		}
		if (!(this.type.type instanceof Structure)) {
			return {
				error: true,
				msg: `Cannot decompose none decomposable type ${this.type.type.name}`,
				ref: ref
			};
		}
		if (this.store === null) {
			return {
				error: true,
				msg: "Cannot decompose an undefined value",
				ref: ref
			};
		}

		return true;
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

		if (this.decomposed) {
			return {
				error: true,
				msg: `Cannot resolve a decomposed value - recommend composing before use`,
				ref
			};
		}

		// Resolve probability
		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		if (this.store === null) {
			return {
				error: true,
				msg: `'${this.name}' is a undefined value since ${this.lastUninit.toString()}`,
				ref: {
					start: this.lastUninit,
					end: ref.end
				}
			};
		} else {
			return {
				register: this.store,
				preamble: new LLVM.Fragment()
			};
		}

		throw "Bad code path";
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





		/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	decompose(ref){
		let check = this.isDecomposable(ref);
		if (check.error) {
			return check;
		}

		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		this.decomposed = true;
		return new LLVM.Fragment();
	}
	/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	compose(ref){
		if (!this.decomposed) {
			return {
				error: true,
				msg: "Cannot compose a non-decomposed value",
				ref: ref
			};
		}

		let frag = new LLVM.Fragment();

		for (let elm of this.elements) {
			let res = elm[1].resolve();
			if (res.error) {
				return res;
			}
			frag.merge(res.preamble);

			let access = this.type.type.accessGEPByIndex(elm[0], this, ref);
			frag.merge(access.preamble);

			let id = new LLVM.ID(ref);
			frag.append(new LLVM.Set(
				new LLVM.Name(id, false, ref),
				access.instruction,
				ref
			));
			frag.append(new LLVM.Store(
				new LLVM.Argument(
					access.type.duplicate().offsetPointer(1).toLLVM(),
					new LLVM.Name(id.reference(), false, ref)
				),
				res.register,
				ref
			));
		}

		this.decomposed = false;
		return frag;
	}

	access(type, accessor) {
		if (!this.decomposed) {
			return {
				error: true,
				msg: "Unable to access element of non-decomposed value",
				ref: accessor.ref
			};
		}

		let struct = this.type.type;
		if (this.type.type instanceof Structure) {
			let res = struct.getTerm(type, accessor, this);
			if (res === null) {
				return {
					error: true,
					msg: `Unable to access element "${accessor.tokens}"`,
					ref: accessor.ref
				};
			}

			if (!this.elements.has(res.index)) {
				let elm = new Variable(res.type, res.index, this.ref);
				elm.markUpdated(res.instruction);

				this.elements.set(res.index, elm);
			}

			return this.elements.get(res.index);
		} else {
			return {
				error: true,
				msg: "Unable to access sub-element of non-structure or static array",
				ref: accessor.ref
			};
		}
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

	createResolutionPoint(options, segment, ref) {
		let id = new LLVM.ID();

		let instr = new LLVM.Latent(new LLVM.Set(
			new LLVM.Name(id, false, ref),
			new LLVM.Phi(this.type.toLLVM(), options.map(x => [
				(x.register ? x.register.name : undefined),
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

	/**
	 *
	 * @param {Error?} ref
	 */
	resolveProbability(ref) {
		if (this.probability) {
			let status = this.probability.resolve(ref);
			if (status !== null && status.error) {
				return status;
			}

			this.store = this.probability.register;
			this.probablity = null;
		}

		return null;
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


	clone() {
		let out = new Variable(this.type, this.name, this.ref);
		out.store = this.store;
		out.isClone = true;
		out.hasUpdated = false;

		return out;
	}
}

module.exports = Variable;