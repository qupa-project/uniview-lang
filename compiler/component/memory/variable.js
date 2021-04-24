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
	constructor (type, name, ref) {
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


	isSuperPosition () {
		return this.possiblity !== null;
	}


	/**
	 * Resolves the possible states of the variable into a single LLVM argument
	 * @private
	 */
	resolve (ref, ignoreComposition = false) {
		if (this.isCorrupt) {
			return {
				error: true,
				msg: `Unable to merge state possibility with originally undefined value`,
				ref
			};
		}

		// Automatically compose value
		let preamble = new LLVM.Fragment();
		if (!ignoreComposition && this.isDecomposed) {
			let res = this.compose(ref);
			if (res.error) {
				return res;
			}
			preamble.merge(res);
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
				preamble: preamble
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
		let out = this.resolve(ref, false);
		if (out.error) {
			return out;
		}

		if (this.type.type.typeSystem == 'linear') {
			this.store = null;
			this.lastUninit = ref.start;
		}

		out.type = this.type;
		return out;
	}

	lend (ref) {
		if (!(this.type.type instanceof Structure)) {
			return {
				error: true,
				msg: `Error: Unable to lend non-linear types`,
				ref: ref
			};
		}


		let out = this.resolve(ref, false);
		if (out.error) {
			return out;
		}
		this.store = out.register;


		return {
			preamble: out.preamble,
			instruction: out.register,
			type: this.type
		};
	}





		/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	decompose (ref){
		// If already decomposed do nothing
		if (this.isDecomposed) {
			return new LLVM.Fragment();
		}

		// Only structures can be decomposed
		if (!(this.type.type.typeSystem == "linear")) {
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
	compose (ref){
		if (!this.isDecomposed) {
			return new LLVM.Fragment(ref);
		}

		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		let frag = new LLVM.Fragment();

		for (let elm of this.elements) {
			let res = elm[1].resolve(ref);
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





	/**
	 *
	 * @param {BNF_Node} accessor
	 * @param {BNF_Reference} ref
	 * @returns {Object[Variable, LLVM.Fragment]|Error}
	 */
	access (accessor, ref) {
		let preamble = new LLVM.Fragment();
		if (!this.isDecomposed) {
			let res = this.decompose(ref);
			/* jshint ignore:start*/
			if (res?.error) {
				return res;
			}
			/* jshint ignore:end*/
			preamble.merge(res);
		}

		let struct = this.type.type;
		if (this.type.type.typeSystem == "linear") {
			let res = struct.getTerm(accessor, this, ref);
			if (res === null) {
				/* jshint ignore:start*/
				return {
					error: true,
					msg: `Unable to access element "${accessor?.tokens || accessor}"`,
					ref: accessor.ref
				};
				/* jshint ignore:end*/
			}

			if (!this.elements.has(res.index)) {
				let elm = new Variable(res.type, res.index, ref);
				elm.markUpdated(res.instruction);

				this.elements.set(res.index, elm);
			}

			return {
				variable: this.elements.get(res.index),
				preamble: preamble
			};
		} else {
			return {
				error: true,
				msg: "Unable to access sub-element of non-structure or static array",
				ref: ref
			};
		}
	}





	markUpdated (register) {
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
	createProbability (segment, needsDecomposition = false, ref) {
		let preamble  = new LLVM.Fragment();
		let activator = null;
		let error     = null;
		let reg       = new LLVM.Constant("null");


		// Decompose if required
		if (needsDecomposition) {
			let res = this.decompose(ref);
			if (res.error) {
				error = res.error;
			} else {
				preamble.merge(res);
			}
		}

		let instr;
		if (!error) {
			instr = this.resolve(ref, true);
			if (instr.error) {
				error = instr.error;
			} else {
				preamble.merge(instr.preamble);
			}
		}

		if (error) {
			activator = new LLVM.Latent(new LLVM.Failure(
				instr.msg, instr.ref
			), ref);
		} else if (instr.register instanceof LLVM.GEP) {
			let id = new LLVM.ID();

			preamble.append(new LLVM.Set(
				new LLVM.Name(id, false, ref),
				instr.register
			));

			if (this.type.type.primative) {
				let nx_id = new LLVM.ID();
				preamble.append(new LLVM.Set(
					new LLVM.Name(nx_id, false, ref),
					new LLVM.Load(
						this.type.toLLVM(),
						new LLVM.Name(id.reference(), false, ref),
						ref
					),
					ref
				));
				id = nx_id;
			}

			reg = new LLVM.Argument(
				this.type.toLLVM(),
				new LLVM.Name(id.reference(), false, ref),
				ref
			);
		} else {
			reg = instr.register;
		}

		return {
			probability: new Probability(activator, reg, segment, ref),
			preamble: preamble
		};
	}

	/**
	 * Create a latent resolution point for resolving the value from multiple child scopes
	 * @param {Variable[]} options
	 * @param {LLVM.ID} segment
	 * @param {BNF_Reference} ref
	 * @returns
	 */
	createResolutionPoint (variables, scopes, segment, ref) {
		let compStatus = GetCompositionState([this, ...variables]);
		let preambles = scopes.map(x => new LLVM.Fragment());
		let frag = new LLVM.Fragment();
		let hasErr = false;


		// Prepare each scope for merging
		let needsDecomposition = compStatus.hasDecomposed && compStatus.hasComposed;
		let opts =
			variables.map((v, i) => v.createProbability(
				scopes[i][0].reference(),
				needsDecomposition,
				ref
			));
		opts.map((x, i) => preambles[i].merge(x.preamble));  // Append preambles to correct scopes
		opts = opts.map(x => x.probability);                 // Extract the probabilities


		// Check for a failure in any branch
		let hasFailure = opts.map(x => x.isFailure()).includes(true);


		// Generate the latent resolution point
		let id = new LLVM.ID();
		let instruction = new LLVM.Latent(
			hasFailure ?
				new LLVM.Failure(
					`Cannot resolve superposition due to some states having internal errors`,
					ref
				) :
				new LLVM.Set(
					new LLVM.Name(id, false, ref),
					new LLVM.Phi(this.type.toLLVM(), opts.map((x, i) => [
						x.register.name,
						new LLVM.Name(x.segment, false, ref)
					]), ref),
					ref
				)
		);
		let register = new LLVM.Argument(
			this.type.toLLVM(),
			new LLVM.Name(id.reference(), false, ref),
			ref
		);
		frag.append(instruction);

		// Mark latent result
		let prob = new Probability(
			instruction,
			register,
			segment,
			ref
		);

		for (let opt of opts) {
			prob.link(opt);
		}
		this.probability = prob;

		if (!hasErr && compStatus.hasDecomposed) {
			// Get all sub-name spaces
			let names = new Set();
			for (let opt of variables) {
				for (let key of opt.elements) {
					names.add(Number(key[0]));
				}
			}

			let links = [];
			for (let opt of variables) {
				let res = opt.decompose(ref);
				/* jshint ignore:start*/
				if (res?.error) {
					links.push(new LLVM.Latent(new LLVM.Failure(
						res.msg,
						res.ref
					), ref));
				}
				/* jshint ignore:end*/
			}

			for (let name of names) {
				let target = this.access(name, ref);
				/* jshint ignore:start*/
				if (target?.error) {
					throw "Unexpected Error";
				}
				/* jshint ignore:end*/
				frag.append(target.preamble);
				target = target.variable;

				let forward = variables.map(v => v.access(name, ref));
				for (let [i, act] of forward.entries()) {
					preambles[i].append(act.preamble);
				}

				let child = target.createResolutionPoint(forward.map(x => x.variable), scopes, segment, ref);

				// Merge information
				for (let i=0; i<preambles.length; i++) {
					preambles[i].append(child.preambles[i]);
				}
				frag.append(child.frag);
			}

		}
		this.hasUpdated = true;


		// Merged two decomposed states
		//   Hence this state is now decomposed
		if (compStatus.hasDecomposed) {
			this.isDecomposed = true;
		}

		return {
			preambles,
			frag
		};
	}

	/**
	 *
	 * @param {Possibility} other
	 */
	addPossibility (poss, segment) {
		if (this.store.length == 0){
			this.isCorrupt = true;
		}

		this.store.push(poss);
	}

	/**
	 * Resolve latent super positions as value needs to be accessed
	 * @param {Error?} ref
	 */
	resolveProbability (ref) {
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





	clone () {
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



/**
 *
 * @param {Variable[]} variables
 */
function GetCompositionState (variables) {
	let composition = variables.map(v => v.isDecomposed);

	return {
		hasDecomposed: composition.filter(val => val == true).length != 0,
		hasComposed: composition.filter(val => val == false).length != 0
	};
}

module.exports = Variable;