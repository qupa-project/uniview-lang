const Flattern = require('../../parser/flattern.js');
const { Generator_ID } = require('../generate.js');
const LLVM = require("../../middle/llvm.js");
const TypeRef = require('./../typeRef.js');
const Variable = require('./variable.js');

class Scope {
	constructor(ctx) {
		this.ctx        = ctx;
		this.variables  = {};
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
			// Check if namespace is already in use
			if (this.variables[arg.name]) {
				this.getFile().throw(
					`Duplicate use of argument ${arg.name} function`,
					this.variables[arg.name].declared, ref
				);

				return null;
			}

			// Creation of namespace
			this.variables[arg.name] = new Variable(
				arg.type.duplicate().offsetPointer(0),
				arg.name,
				arg.ref
			);

			// Declaration in function argument
			let id = new LLVM.ID();
			registers.push(new LLVM.Argument(
				this.variables[arg.name].type.toLLVM(),
				new LLVM.Name(id, false)
			));

			// Assigning name space to argument value
			this.variables[arg.name].markUpdated(new LLVM.Argument(
				this.variables[arg.name].type.toLLVM(),
				new LLVM.Name(id.reference(), false)
			));
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

		this.variables[name] = new Variable(type, name, ref);
		return this.variables[name];
	}

	/**
	 * Get the register holding the desired value
	 * @param {BNF_Node} ast
	 * @returns {Variable}
	 */
	getVar(ast) {
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
	 * PreSync must be ran in each scope first
	 * @param {Scope} scopes
	 */
	sync(scopes, segment, ref) {
		let frag = new LLVM.Fragment();

		for (let name in this.variables) {

			let opts = scopes
				.map(tuple => tuple[1].variables[name].createProbability(
					tuple[0],
					ref
				));

			frag.append(this.variables[name].resolvePossibilities(opts, segment, ref));
		}

		return frag;
	}
}

module.exports = Scope;