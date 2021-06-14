const LLVM = require('../../middle/llvm.js');
const Structure = require('../struct.js');
const TypeRef = require('../typeRef.js');

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

	isUndefined () {
		if (this.isDecomposed) {
			// Not all terms have GEPs let alone undefined
			if (this.elements.size < this.type.type.terms.length) {
				return false;
			}

			// Check all children are undefined
			for (let elm of this.elements) {
				if (elm[1].isUndefined() == false) {
					return false;
				}
			}

			return true;
		} else {
			return this.store == null && this.probability == null;
		}
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
		}


		// If the current store is a non-loaded GEP
		//   Load the GEP ready for use
		if (this.store instanceof LLVM.GEP) {
			throw new Error("GEPs should be handled by probability resolution");
		}


		return {
			register: this.store,
			preamble: preamble
		};
	}





	/**
	 * Read the value of a variable
	 * @param {LLVM.BNF_Reference} ref
	 * @returns {LLVM.Argument|Error}
	 */
	read (ref) {
		let out = this.resolve(ref, false);
		if (out.error) {
			return out;
		}

		if (this.type.type.typeSystem == 'linear') {
			if (this.type.lent) {
				return {
					error: true,
					msg: "Cannot give ownership of a borrowed value to a child function",
					ref
				};
			}

			this.store = null;
			this.lastUninit = ref.start;
		}

		out.type = this.type;
		return out;
	}

	/**
	 * Updated the variable to a new value
	 * @param {LLVM.Argument} register
	 * @param {Boolean} force apply the update even if the value is borrowed
	 * @param {*} ref
	 * @returns {Error?}
	 */
	markUpdated (register, force = false, ref) {
		if (!force && this.type.lent) {
			return {
				error: true,
				msg: "Cannot overwite a lent value",
				ref
			};
		}

		this.store = register;
		this.probability = null;
		this.lastUninit = null;
		this.hasUpdated = true;
		this.isDecomposed = false;

		return true;
	}

		/**
	 *
	 * @param {BNF_Node} accessor
	 * @param {BNF_Reference} ref
	 * @returns {Object[Variable, LLVM.Fragment]|Error}
	 */
	access (accessor, ref) {
		let preamble = new LLVM.Fragment();

		// Resolve any probabilities
		let res = this.resolve(ref, true);
		if (res.error) {
			return res;
		}
		preamble.merge(res.preamble);

		if (accessor.tokens != undefined) {
			throw new Error("Invalid variable accessor");
		}

		// Automatically decompoase the value if needed
		if (!this.isDecomposed) {
			let res = this.decompose(ref);
			if (res.error) {
				return res;
			}
			preamble.merge(res);
		}

		let struct = this.type.type;
		if (this.type.type.typeSystem == "linear") {
			let gep = struct.getTerm(accessor);
			if (gep === null) {
				return {
					error: true,
					msg: `Unable to access element "${accessor}"`,
					ref: ref
				};
			}

			if (!this.elements.has(gep.index)) {
				let read = struct.accessGEPByIndex(gep.index, this.store);
				let elm = new Variable(
					read.type,
					`${this.name}.${accessor}`,
					ref.start
				);

				let act = new LLVM.Latent(read.preamble, ref);
				preamble.append(act);

				elm.probability = new Probability(
					act,
					read.instruction,
				"0", ref);
				this.elements.set(gep.index, elm);
			}

			return {
				variable: this.elements.get(gep.index),
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



	lendValue (ref) {
		// Resolve to composed state
		let out = this.resolve(ref, false);
		if (out.error) {
			return out;
		}

		this.store = out.register;

		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();
		let instruction = out.register;

		preamble.merge(out.preamble);

		let type = this.type.duplicate();
		type.lent = true;

		if (this.type.type.typeSystem == "normal") {
			let ptr = new LLVM.ID();

			preamble.append(new LLVM.Set(
				new LLVM.Name(ptr, false, ref),
				new LLVM.Alloc(this.type.toLLVM(), ref)
			));

			preamble.append(new LLVM.Store(
				new LLVM.Argument(
					type.toLLVM(),
					new LLVM.Name(ptr, false, ref)
				),
				out.register,
				ref
			));

			let val = new LLVM.ID();
			epilog.append(new LLVM.Set(
				new LLVM.Name(val, false, ref),
				new LLVM.Load(
					this.type.toLLVM(),
					new LLVM.Name(ptr.reference(), false, ref),
					ref
				)
			));

			instruction = new LLVM.Argument(
				type.toLLVM(),
				new LLVM.Name(ptr.reference(), false, ref),
				ref
			);

			this.store = new LLVM.Argument(
				this.type.toLLVM(),
				new LLVM.Name(val.reference(), false, ref),
				ref
			);
		}

		return {
			preamble, epilog, instruction, type
		};
	}

	cloneValue (ref) {
		// Resolve to composed/probability state
		let out = this.resolve(ref, false);
		if (out.error) {
			return out;
		}

		if (
			this.type.type.typeSystem == "normal" ||
			!this.type.type.cloneInstance
		) {
			return {
				preamble: new LLVM.Fragment(),
				instruction: this.store,
				type: this.type.duplicate()
			};
		}

		this.store = out.register;
		let preamble = out.preamble;

		// Clone the register
		let clone = this.type.type.cloneInstance(out.register, ref);
		preamble.merge(clone.preamble);

		let type = this.type.duplicate();
		type.lent = false;

		return {
			preamble: preamble,
			instruction: clone.instruction,
			type: type
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

			let access = this.type.type.accessGEPByIndex(elm[0], this.store, ref, false);
			frag.merge(access.preamble);

			let store = res.register;
			let isLinear = elm[1].type.type.typeSystem == "linear";
			if (isLinear) {
				let type = elm[1].type.duplicate().toLLVM(ref, true);
				let id = new LLVM.ID(ref);
				frag.append(new LLVM.Set(
					new LLVM.Name(id, false, ref),
					new LLVM.Load(
						type,
						store.name,
						ref
					),
					ref
				));

				store = new LLVM.Argument(
					type,
					new LLVM.Name(id.reference(), false, ref),
					ref
				);
			}

			frag.append(new LLVM.Store(
				access.instruction,
				store,
				ref
			));
		}

		this.isDecomposed = false;
		return frag;
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
				error = res;
				error.msg += "469";
			} else {
				preamble.merge(res);
			}
		}

		let instr;
		if (!error) {
			instr = this.resolve(ref, true);

			if (instr.error) {
				error = instr;
				error.msg += "483";
			} else {
				preamble.merge(instr.preamble);
			}
		}

		if (error) {
			activator = new LLVM.Latent(new LLVM.Failure(
				error.msg, error.ref
			), ref);
		} else if (instr.register instanceof LLVM.GEP) {
			throw new Error("Bad code path, GEP should have been removed within this.resolve()");
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
				if (res.error) {
					links.push(new LLVM.Latent(new LLVM.Failure(
						res.msg,
						res.ref
					), ref));
				}
			}

			for (let name of names) {
				let target = this.access(name, ref);
				if (!target || target.error) {
					throw "Unexpected Error";
				}
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


	/**
	 * Trigger falling out of scope behaviour
	 * @param {BNF_Reference} ref
	 * @returns {LLVM.Fragment|Error}
	 */
	cleanup(ref) {
		let frag = new LLVM.Fragment();

		if (this.isClone) {            // Do nothing as this variable is a clone
			return frag;
		} else if (this.type.lent) {   // Borrowed types need to be recomposed
			let res = this.resolve(ref, false);
			if (res.error) {
				return res;
			}

			frag.merge(res.preamble);
		} else {                       // Run destruct behaviour
			if (
				this.type.type.meta == "CLASS" &&
				!this.isUndefined(ref)
			) {
				return {
					error: true,
					msg: `Variable "${this.name}" is still defined. All classes must be consumed`,
					ref: ref
				};
			}
		}

		return frag;
	}

	delete (ref) {
		if (this.isUndefined()) {
			return {
				error: true,
				msg: "Cannot delete an already undefined value",
				ref: ref
			};
		}

		this.elements = new Map();
		this.isDecomposed = false;
		this.probability = null;
		this.store = null;
		this.lastUninit = ref.start;
		return new LLVM.Fragment();
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