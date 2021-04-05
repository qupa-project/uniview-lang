const LLVM = require('../../middle/llvm.js');
const Structure = require('../struct.js');
const TypeRef = require('../typeRef.js');

const Constant = require('./constant.js');
const Value = require('./value.js');

const Probability = require('./probability.js');




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
		this.isDecomposed = false;

		this.lastUninit = ref;

		this.isCorrupt = false; // Is there an invalid state tree
		this.isClone = false;
		this.hasUpdated = false;

		this.elements = new Map();
	}


	isSuperPosition() {
		return this.possiblity !== null;
	}


	/**
	 * Resolves the possible states of the variable into a single LLVM argument
	 * @private
	 */
	resolve (ref, allowDecomposition = false) {
		if (this.isCorrupt) {
			return {
				error: true,
				msg: `Unable to merge state possibility with originally undefined value`,
				ref
			};
		}

		if (!allowDecomposition && this.isDecomposed) {
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
		// If already decomposed do nothing
		if (this.isDecomposed) {
			return new LLVM.Fragment();
		}

		// Only structures can be decomposed
		if (!(this.type.type instanceof Structure)) {
			return {
				error: true,
				msg: `Cannot decompose none decomposable type ${this.type.type.name}`,
				ref: ref
			};
		}

		// Cannot decompse an undefined value
		if (this.store === null) {
			return {
				error: true,
				msg: "Cannot decompose an undefined value",
				ref: ref
			};
		}

		// Ensure any super positions are resolved before decomposition
		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		// Mark decposed
		this.isDecomposed = true;
		return new LLVM.Fragment();
	}
	/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	compose(ref){
		if (!this.isDecomposed) {
			return {
				error: true,
				msg: "Cannot compose a non-decomposed value",
				ref: ref
			};
		}

		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
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

		this.isDecomposed = false;
		return frag;
	}





	access(type, accessor) {
		if (!this.isDecomposed) {
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
		this.isDecomposed = false;
	}





	/**
	 * Prepare this variable to be merged with a higher scope
	 * @param {LLVM.ID} segment
	 * @param {BNF_Reference} ref
	 * @returns
	 */
	createProbability(segment, ref) {
		let instr = this.resolve(ref, true);
		let activator = null;

		if (instr.error) {
			activator = new LLVM.Latent(new LLVM.Failure(
				instr.msg, instr.ref
			), ref);
		}

		return new Probability(activator, instr.register, segment, ref);
	}

	/**
	 * Create a latent resolution point for resolving the value from multiple child scopes
	 * @param {Probability[]} options
	 * @param {LLVM.ID} segment
	 * @param {BNF_Reference} ref
	 * @returns
	 */
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
	 * @param {Possibility} other
	 */
		 addPossibility(poss, segment) {
			if (this.store.length == 0){
				this.isCorrupt = true;
			}

			this.store.push(poss);
		}

	/**
	 * Resolve latent super positions as value needs to be accessed
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





	clone() {
		let out = new Variable(this.type, this.name, this.ref);
		out.store = this.store;
		out.isClone = true;
		out.hasUpdated = false;
		out.isDecomposed = this.isDecomposed;

		if (this.isDecomposed) {
			for (let tuple of this.elements) {
				out.elements.set(tuple[0], tuple[1].clone());
			}
		}

		return out;
	}
}

module.exports = Variable;