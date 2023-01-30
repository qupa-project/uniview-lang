const LLVM = require("../../middle/llvm.js");
const TypeRef = require('./../typeRef.js');

const Variable = require('./variable.js');

class Scope {
	constructor (ctx) {
		this.ctx        = ctx;
		this.variables  = {};
		this.isChild    = false;

		this.lentNormals = [];
	}



	/**
	 * Return the file of which this scope is within
	 * @returns {File}
	 */
	getFile () {
		return this.ctx.getFile();
	}

	/**
	 * Return the parent scope if this is a sub scope
	 * @returns {Scope|null}
	 */
	getParent () {
		if (this.ctx instanceof Scope) {
			return this.ctx;
		}
		return null;
	}



	/**
	 * Registers all arguments as local variables in correct order
	 * @param {Object[]} args
	 */
	register_Args (args) {
		let frag = new LLVM.Fragment();
		let registers = [];

		for (let arg of args) {
			// Check if namespace is already in use
			if (this.variables[arg.name]) {
				this.getFile().throw(
					`Duplicate use of argument ${arg.name} function`,
					this.variables[arg.name].ref.start, arg.ref.end
				);

				return null;
			}

			// Load any lent normal types so they can be treated as normal variables
			let id = new LLVM.ID();
			let type = arg.type;
			let reg = new LLVM.Name(id.reference(), false);

			// Creation of namespace
			this.variables[arg.name] = new Variable(
				type.duplicate(),
				arg.name,
				arg.ref
			);

			// Declaration in function argument
			registers.push(new LLVM.Argument(
				arg.type.toLLVM(),
				new LLVM.Name(id, false)
			));

			// Assigning name space to argument value
			let chg = this.variables[arg.name].markUpdated(
				new LLVM.Argument(
					this.variables[arg.name].type.toLLVM(),
					reg
				),
				true,
				{
					start: arg.ref,
					end: arg.ref
				}
			);
			if (chg.error) {
				this.getFile().throw(chg.msg, chg.ref.start, chg.ref.end);
				return null;
			}

			// force will never generate a code fragment
			this.variables[arg.name].hasUpdated = false;
		}

		return {frag, registers};
	}



	/**
	 * Define a new variable
	 * @param {TypeDef} type
	 * @param {Number} pointerLvl
	 * @param {String} name
	 * @param {BNF_Reference} ref
	 * @returns {void}
	 */
	register_Var (type, name, ref) {
		if (this.variables[name]) {
			this.getFile().throw(
				`Duplicate declaration of name ${name} in scope`,
				this.variables[name].ref, ref
			);
		}

		this.variables[name] = new Variable(type, name, ref);
		return this.variables[name];
	}

	/**
	 * Get the register holding the desired value
	 * @param {BNF_Node} ast
	 * @returns {Variable}
	 */
	getVar (ast, read = true) {
		switch (ast.type) {
			case "variable":
			case "access":
				break;
			default:
				throw new TypeError(`Parsed AST must be a branch of type variable, not "${ast.type}"`);
		}

		let target = this.variables[ast.value[0].value];
		if (!target) {
			return {
				error: true,
				msg: `Unknown variable name "${ast.value[0].value}"`,
				ref: ast.value[0].ref
			};
		}


		return target;
	}

	/**
	 * Get the type of a given variable
	 * @param {BNF_Node} ast
	 */
	getVarType (ast) {
		if (ast.type != "variable") {
			throw new TypeError(`Parsed AST must be a branch of type variable, not "${ast.type}"`);
		}

		let target = this.variables[ast.tokens[1].tokens];
		if (target) {
			if (ast.tokens.length > 2) {
				let load = target.getTypeOf(ast.tokens.slice(2));
				if (load.error) {
					return load;
				}
				target = load.register;
			}
		} else {
			return {
				error: true,
				msg: `Unknown variable name ${ast.tokens[1].tokens}`,
				ref: {
					start: ast.tokens[1].ref.start,
					end: ast.tokens[1].ref.end
				}
			};
		}

		return new TypeRef(target.type);
	}

	/**
	 * Returns true if this name is defined
	 * @param {String} name
	 * @returns {Bool}
	 */
	hasVariable (name) {
		return name in this.variables;
	}




	cascadeUpdates () {
		for (let name in this.variables) {
			this.variables[name].cascadeUpdates();
		}
	}




	/**
	 * Deep clone
	 * @returns {Scope}
	 */
	clone () {
		let out = new Scope(this.ctx, this.caching, this.generator);
		for (let name in this.variables) {
			out.variables[name] = this.variables[name].clone();
		}
		out.isClone = true;
		out.hasUpdated = false;

		return out;
	}


	/**
	 * Trigger falling out of scope behaviour for all variables
	 * @param {BNF_Reference} ref
	 * @returns {LLVM.Fragment|Error}
	 */
	cleanup (ref) {
		let frag = new LLVM.Fragment();
		for (let name in this.variables) {
			let res = this.variables[name].cleanup(ref);
			if (res.error) {
				return res;
			}
			frag.merge(res);
		}


		for (let val of this.lentNormals) {
			let res = val[0].read(ref);
			frag.merge(res.preamble);

			let lentType = res.type.duplicate();
			lentType.lent = true;

			frag.append(new LLVM.Store(
				new LLVM.Argument(lentType.toLLVM(), val[1]),
				res.register
			));
		}

		return frag;
	}

	/**
	 * PreSync must be ran in each scope first
	 * @param {Branch} branches
	 * @returns {Object|Error}
	 */
	sync (branches, ref) {
		let preambles = branches.map(x => new LLVM.Fragment());
		let frag = new LLVM.Fragment();

		if (branches.length == 0) {
			throw new Error("Cannot sync zero branches");
		}

		// Ensure any parents are marked as updated
		//   if their children were
		for (let branch of branches) {
			branch.scope.cascadeUpdates();
		}

		// If there is only one valid state
		if (branches.length == 1) {
			for (let name in this.variables) {
				// Reclaim any value that isn't a clone of a clone due to resting
				branches[0].scope.variables[name].isClone = this.variables[name].isClone;
				this.variables[name] = branches[0].scope.variables[name];
			}
		} else {
			for (let name in this.variables) {
				// If the value is undefined in all states
				//   Resolve the result to be undefined with no errors
				if (!branches.map( x => x.scope.variables[name].isUndefined()).includes(false)) {
					this.variables[name].makeUndefined(ref);
					continue;
				}

				// This value was not updated
				//   Thus is can be skipped
				if (!branches.map(x => x.scope.variables[name].hasUpdated).includes(true)) {
					continue;
				}

				console.log(290, branches)

				let res = this.variables[name].resolveBranches(
					branches.map(exec => {
						return {
							block: exec.entryPoint,
							variable: exec.scope.variables[name]
						};
					}),
					ref
				);

				if (res.error) {
					return res;
				}

				// Merge in the preambles
				preambles
					.map((x, i) => x.merge(res.preambles[i]));

				frag.append(res.frag);
			}
		}

		return {frag, preambles};
	}

	/**
	 * Claims all values as owned by this scope
	 * Used for when this scope finishes a function
	 * @param {*} ref
	 */
	reclaim() {
		for (let name in this.variables) {
			this.variables[name].isClone = false;
		}
	}
}

module.exports = Scope;