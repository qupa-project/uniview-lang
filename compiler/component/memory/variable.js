const chalk = require('chalk');
const LLVM = require('../../middle/llvm.js');
const Structure = require('../struct.js');
const TypeRef = require('../typeRef.js');

const Value = require('./value.js');

const { SyntaxNode } = require('bnf-parser');




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

		this.isDecomposed = false;

		this.lastUninit = ref;

		this.isCorrupt = false; // Is there an invalid state tree
		this.err = null;

		this.isClone = false;
		this.hasUpdated = false;

		this.elements = new Map();
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
			return this.store == null;
		}
	}

	cascadeUpdates () {
		if (this.hasUpdated) {
			return;
		}

		for (let elm of this.elements) {
			elm[1].cascadeUpdates();

			if (elm[1].hasUpdated) {
				this.hasUpdated = true;
				return;
			}
		}
	}


	/**
	 * Resolves the possible states of the variable into a single LLVM argument
	 * @private
	 */
	resolve (ref, ignoreComposition = false) {
		if (this.isCorrupt) {
			return this.err || {
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
			throw new Error("GEPs should be handled by branch resolution");
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

		if (this.type.native) {
			if (this.type.lent) {
				let loadID = new LLVM.ID();
				let loadType = out.register.type.duplicate().offsetPointer(-1);
				out.preamble.append(new LLVM.Set(
					new LLVM.Name(loadID, false, ref),
					new LLVM.Load(loadType, out.register.name, ref),
					ref
				));

				out.type = loadType;
				out.register = new LLVM.Argument(
					loadType,
					new LLVM.Name(loadID.reference(), false, ref),
				ref);
			}
		} else {
			if (this.type.lent) {
				return {
					error: true,
					msg: "Cannot give ownership of a borrowed value to a child function",
					ref
				};
			} else if (this.type.constant) {
				return {
					error: true,
					msg: `Cannot consume a constant value\n  Recommend cloning $${this.name}`,
					ref
				};
			}

			this.makeUndefined(ref);
			this.lastUninit = ref.start;
		}

		out.type = this.type;
		return out;
	}

	makeUndefined(ref) {
		this.elements.clear();
		this.isDecomposed = false;
		this.store = null;
		this.lastUninit = ref.start;
	}

	/**
	 * Updated the variable to a new value
	 * @param {LLVM.Argument} register
	 * @param {Boolean} force the update to apply with no execution taking place
	 * @param {*} ref
	 * @returns {Error?}
	 */
	markUpdated (register, force = false, ref) {
		if (!force) {
			if (this.type.constant) {
				return {
					error: true,
					msg: "Cannot change a constant value",
					ref
				};
			}

			if (this.type.lent) {
				let res = this.cleanup(ref);
				if (res.error) {
					return res;
				}
				let frag = res;

				let target = register;
				if (register.pointer > 0) {
					let frag = res;
					let loadID = new LLVM.ID();
					let loadType = register.type.duplicate().offsetPointer(-1);
					frag.append(new LLVM.Set(
						new LLVM.Name(loadID, false, ref),
						new LLVM.Load(loadType, register, ref),
						ref
					));

					target = new LLVM.Argument(
						loadType,
						new LLVM.Name(loadID.reference(), false, ref),
					ref);
				}

				frag.append(new LLVM.Store(
					this.store,
					target,
					ref
				));

				return frag;
			}
		}

		this.isDecomposed = false;
		this.hasUpdated = true;
		this.store = register;

		return new LLVM.Fragment();
	}

		/**
	 *
	 * @param {BNF_Node} accessor
	 * @param {BNF_Reference} ref
	 * @returns {Object[Variable, LLVM.Fragment]|Error}
	 */
	access (accessor, ref) {
		if (accessor instanceof SyntaxNode) {
			throw new Error("Unexpected syntax node");
		}

		let preamble = new LLVM.Fragment();

		// Resolve any probabilities
		let res = this.resolve(ref, true);
		if (res.error) {
			return res;
		}
		preamble.merge(res.preamble);

		// Automatically decompose the value if needed
		if (!this.isDecomposed) {
			let res = this.decompose(ref);
			if (res.error) {
				return res;
			}
			preamble.merge(res);
		}

		let struct = this.type.type;
		if (!(struct instanceof Structure)) {
			return {
				error: true,
				msg: "Unable to access sub-element of non-structure or static array",
				ref: ref
			};
		}

		let gep = struct.getTerm(accessor);
		if (gep === null) {
			return {
				error: true,
				msg: `Unable to access element "${accessor}"`,
				ref: ref
			};
		}

		let out;
		if (!this.elements.has(gep.index)) {
			// Access element
			let read = struct.accessGEPByIndex(gep.index, this.store);
			preamble.merge(read.preamble);

			// Create a the new variable
			read.type.constant = read.type.constant || this.type.constant;
			out = new Variable(
				read.type,
				`${this.name}.${accessor}`,
				ref.start
			);

			this.elements.set(gep.index, out);
			out.store = read.instruction;
		}

		return {
			variable: this.elements.get(gep.index),
			preamble: preamble
		};
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

		if (!this.type.lent && this.type.native) {
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
		return {
			error: true,
			msg: "Old code path hit",
			ref: ref
		};
	}





	isComposable() {
		if (this.isCorrupt) {
			return false;
		}

		// Already composed
		if (this.isDecomposed == false) {
			return true;
		}

		// If all elements are ready to be composed
		return this.elements.values()
			.map(v => !v.isUndefined && v.isComposable)
			.reduce((c, p) => c && p, true);
	}

	/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	compose (ref){
		if (!this.isDecomposed) {
			return new LLVM.Fragment(ref);
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
				let type = elm[1].type.toLLVM(ref);
				if (!elm[1].type.native) {
					type.offsetPointer(-1);
				}

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

		this.elements.clear();
		this.isDecomposed = false;
		return frag;
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

		// Cannot decompose an undefined value
		if (this.store === null) {
			return {
				error: true,
				msg: "Cannot decompose an undefined value",
				ref: ref
			};
		}

		this.isDecomposed = true;
		return new LLVM.Fragment();
	}







	resolveBranches(choices, ref) {
		let compStatus = GetCompositionState(
			choices.map(x => x.variable)
		);
		let preambles = choices.map(_ => new LLVM.Fragment());
		let frag = new LLVM.Fragment();


		/*================================
		  Prepare each scope for merging
		=================================*/
		if (compStatus.hasDecomposed) {
			let composable = choices.map(c => c.variable.isComposable());
			if (composable) {
				choices.map((c, i) => {
					let res = c.variable.compose();
					if (res.error) {
						throw new Error("How? it said it was composable...");
					}
					preambles[i].merge(res);
				});
			} else {
				throw new Error("Unimplemented: Needs to cascade resolution down the tree");
			}
		}

		let blanks = choices.map(c => c.variable.store === null);

		// Undefined in all states
		if (!blanks.includes(false)) {
			this.makeUndefined(ref);
			return { preambles, frag };
		}

		// Undefined in one but not all states
		if (blanks.includes(true)) {
			this.makeUndefined(ref);

			return {
				error: true,
				msg: `Cannot merge branch states, due to mixed undefined states of variable ${chalk.green(this.name)}.\n` +
					"The variable must be defined or undefined in all states, but not a combination of the two",
				start: ref.start,
				end: ref.end
			};
		}

		let opts = choices.map(c => [
			c.variable.store.name,
			new LLVM.Name(c.block.reference(), false, ref),
		]);

		opts
			.filter(x => x[0].error)
			.map(x => {
				this.isCorrupt = true;
				this.err = x;
			});

		console.log(565, opts);

		let id = new LLVM.ID();
		let instruction = new LLVM.Set(
			new LLVM.Name(id, false, ref),
			new LLVM.Phi(this.type.toLLVM(), opts, ref),
			ref
		);
		let register = new LLVM.Argument(
			this.type.toLLVM(),
			new LLVM.Name(id.reference(), false, ref),
			ref
		);
		frag.append(instruction);
		this.markUpdated(register, true, ref);

		return {
			preambles,
			frag
		};
	}



	induceType(type, register, ref) {
		throw new Error("When statements have been removed and will be replaced with match statements");
	}

	// Reverts the behaviour of induceType
	deduceType(type, register, ref) {
		throw new Error("When statements have been removed and will be replaced with match statements");
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

		if (this.isClone || this.type.constant) {  // Do nothing as this variable is a clone/constant
			return frag;
		} else if (this.type.lent) {   // Borrowed types need to be recomposed
			let res = this.resolve(ref, false);
			if (res.error) {
				res.msg = "All lent values must be fully resolvable\n  " + res.msg;
				return res;
			}

			frag.merge(res.preamble);
		} else {                       // Run destruct behaviour
			// The value has not been consumed and will fall out of scope
			if (!this.isUndefined(ref)) {
				let del = this.type.type.getDestructor();
				if (del) {
					let res = this.read(ref);
					if (res.error) {
						return res;
					}

					frag.merge(res.preamble);
					frag.append(new LLVM.Call(
						new LLVM.Type("void", 0, ref),
						new LLVM.Name(del.represent, true, ref),
						[res.register]
					));
				} else {
					if (this.type.type instanceof Structure) {
						let names = this.type.type.terms
							.filter(x => x.typeRef.type instanceof Structure)
							.map(x => x.name);

						for (let name of names) {
							let res = this.access(name, ref);
							if (res.error) {
								return res;
							}
							frag.append(res.preamble);

							res = res.variable.cleanup(ref);
							if (res.error) {
								return res;
							}
							frag.append(res);
						}

						this.makeUndefined(ref);
					}
				}
			}
		}

		return frag;
	}
}



/**
 *
 * @param {Variable[]} variables
 */
function GetCompositionState (variables) {
	return variables
		.reduce((c, p) => {
			return {
				hasDecomposed: p.hasDecomposed || c.isDecomposed,
				hasComposed: p.hasComposed || !c.isDecomposed,
			};
		}, {
			hasComposed: false, hasDecomposed: false
		});
}

module.exports = Variable;