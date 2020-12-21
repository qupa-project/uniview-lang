const Flattern = require('../../parser/flattern.js');
const { Generator_ID } = require('../generate.js');
const LLVM = require("../../middle/llvm.js");
const TypeRef = require('./../typeRef.js');
const Register = require('./variable.js');

class Scope {
	static raisedVariables = true; // whether or not a variable can be redefined within a new scope

	constructor(ctx, caching = true) {
		this.ctx        = ctx;
		this.variables  = {};
		this.caching    = caching;
		this.isChild    = false;
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
	getParent() {
		if (this.ctx instanceof Scope) {
			return this.ctx;
		}
		return null;
	}



	/**
	 * Registers all arguments as local variables in correct order
	 * @param {Object[]} args
	 */
	register_Args(args) {
		let frag = new LLVM.Fragment();
		let registers = [];

		for (let arg of args) {
			if (this.variables[arg.name]) {
				this.getFile().throw(
					`Duplicate use of argument ${arg.name} function`,
					this.variables[arg.name].declared, ref
				);

				return null;
			}

			this.variables[arg.name] = new Register(
				arg.type.duplicate().offsetPointer(1),
				arg.name,
				arg.ref
			);
			if (arg.pointer > 0) {
				this.variables[arg.name].isConcurrent = true;
			}

			let cache = new Register(
				arg.type,
				arg.name,
				arg.ref
			);
			this.variables[arg.name].cache = cache;
			cache.isConcurrent = arg.pointer > 0;
			registers.push(cache);

			frag.append(new LLVM.Set(
				new LLVM.Name(
					this.variables[arg.name].id,
					false,
					arg.ref
				),
				new LLVM.Alloc(
					arg.type.toLLVM(arg.ref),
					arg.ref
				),
				arg.ref
			));
			this.variables[arg.name].markUpdated();
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
	register_Var(type, name, ref) {
		if (Scope.raisedVariables) {
			let parent = this.getParent();
			if (parent) {
				return parent.register_Var(type, name, ref);
			}
		}

		if (this.variables[name]) {
			if (this.variables[name].isClone && !Scope.raisedVariables) {
				// When scoped variables are added
				// Ensure that any changes to the original are flushed before
				//   redeclaring
			}

			this.getFile().throw(
				`Duplicate declaration of name ${name} in scope`,
				this.variables[name].declared, ref
			);
		}

		this.variables[name] = new Register(type, name, ref);
		return this.variables[name];
	}

	/**
	 * Get the register holding the desired value
	 * @param {BNF_Node} ast
	 * @param {Boolean} read Will this value be read? Or only written
	 * @returns {Object}
	 */
	getVar(ast, read = true) {
		if (ast.type != "variable") {
			throw new TypeError(`Parsed AST must be a branch of type variable, not "${ast.type}"`);
		}

		let target = this.variables[ast.tokens[1].tokens];
		if (!target) {
			return {
				error: true,
				msg: `Unknown variable name ${ast.tokens[1].tokens}`,
				ref: ast.tokens[1].ref
			};
		}


		return target;
	}

	/**
	 * Get the type of a given variable
	 * @param {BNF_Node} ast
	 */
	getVarType(ast) {
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

		return new TypeRef (target.pointer - ast.tokens[0], target.type);
	}

	/**
	 * Returns true if this name is defined
	 * @param {String} name
	 * @returns {Bool}
	 */
	hasVariable(name) {
		return name in this.variables;
	}






	/**
	 * Deep clone
	 * @returns {Scope}
	 */
	clone() {
		let out = new Scope(this.ctx, this.caching, this.generator);
		for (let name in this.variables) {
			out.variables[name] = this.variables[name].clone();
		}
		out.child = true;

		return out;
	}

	/**
	 * Clears the cache of every
	 */
	clearAllCaches() {
		for (let name in this.variables) {
			this.variables[name].clearCache();
		}
	}

	/**
	 * Flushes all variable caches
	 * @param {BNF_Reference} ref
	 * @param {Boolean} allowGEPS
	 * @returns {LLVM.Fragment}
	 */
	flushAll(ref, allowGEPS) {
		let frag = new LLVM.Fragment();

		for (let name in this.variables) {
			frag.merge( this.variables[name].flushCache(ref, allowGEPS) );
		}

		return frag;
	}

	/**
	 * Flush all cloned variables
	 * @param {BNF_Reference} ref
	 * @returns {LLVM.Fragment}
	 */
	flushAllClones (ref) {
		let frag = new LLVM.Fragment();

		for (let name in this.variables) {
			if (this.variables[name].isClone) {
				frag.merge( this.variables[name].flushCache(ref) );
			}
		}

		return frag;
	}

	/**
	 * Flush all concurrent variables
	 * @param {BNF_Reference} ref
	 * @returns {LLVM.Fragment}
	 */
	flushAllConcurrents(ref) {
		let frag = new LLVM.Fragment();

		for (let name in this.variables) {
			if (
				this.variables[name].isConcurrent &&
				this.variables[name].cache
			) {
				let out = this.variables[name].cache.flushCache(ref, true);
				frag.merge( out );
			}
		}

		return frag;
	}

	/**
	 *
	 * @param {Scope[]} group
	 * @param {LLVM.ID[]} entries
	 */
	syncScopes(group, entries) {
		let frags = group.map ( x => new LLVM.Fragment() );
		let sync = new LLVM.Fragment();

		for (let name in this.variables) {
			let regGroup = group.map( x => x.variables[name] );
			let form = Register.GetProminentForm(regGroup);

			// Convert all registers to the same cache form
			for (let i=0; i<frags.length; i++) {
				frags[i].merge(
					regGroup[i].changeForm(this, form)
				);
			}

			// Resolve all versions
			sync.merge(this.variables[name].mergeUpdates(
				regGroup,
				entries,
				form
			));
		}

		return { frags, sync };
	}




	prepareRecursion(block, ref) {
		let prolog  = new LLVM.Fragment();
		let state = {};

		for (let name in this.variables) {
			if ( this.variables[name].type.pointer < 1	) {
				continue;
			}

			if (this.variables[name].cache === null) {
				prolog.merge(this.variables[name].deref(1));
			}

			state[name] = {
				id: new LLVM.ID(),
				type: this.variables[name].type.duplicate().offsetPointer(-1),
				block: block,
				val: this.variables[name].cache.toLLVM()
			};

			this.variables[name].cache = new Register(
				state[name].type,
				name,
				ref
			);
			this.variables[name].cache.id = state[name].id.reference();
		}

		return {prolog, state};
	}

	resolveRecursion(state, block, ref) {
		let prolog = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();

		for (let name in state) {
			if (this.variables[name].cache === null) {
				epilog.merge(this.variables[name].deref(1));
			}

			let opts = [
				[ state[name].val.name, new LLVM.Name(state[name].block, false, ref) ],
				[ this.variables[name].cache.toLLVM().name, new LLVM.Name(block, false, ref) ]
			];

			prolog.append(new LLVM.Set(
				new LLVM.Name (state[name].id, false, ref),
				new LLVM.Phi (state[name].type.toLLVM(), opts, ref
			)));
		}

		return { prolog, epilog };
	}
}

module.exports = Scope;