const Flatten = require('../../parser/flatten.js');
const LLVM     = require("../../middle/llvm.js");
const TypeRef = require('../typeRef.js');
const { load } = require('npm/lib/config/core.js');
const { SyntaxNode } = require('bnf-parser');

const Primative = {
	types: require('./../../primative/types.js')
};

class ExecutionBase {
	/**
	 *
	 * @param {Function|ExecutionBase} ctx
	 * @param {*} returnType
	 * @param {*} scope
	 */
	constructor (ctx, returnType, scope, entryPoint = new LLVM.ID()) {
		this.ctx        = ctx;
		this.scope      = scope;
		this.returnType = returnType;
		this.returned   = false;
		this.isChild    = false;

		this.entryPoint = entryPoint.reference();
	}


	getFunctionGroup () {
		return this.ctx.getFunctionGroup();
	}
	getFunctionInstance () {
		return this.ctx.getFunctionInstance();
	}

	/**
	 * Return the file of which this scope is within
	 */
	getFile () {
		return this.ctx.getFile();
	}

	/**
	 * Return the parent scope if this is a sub scope
	 */
	getParent () {
		if (this.ctx instanceof ExecutionBase) {
			return this.ctx;
		}
		return null;
	}

	/**
	 * Return the function this scope is within
	 * @param {SyntaxNode[]}
	 * @param {TypeRef[]}
	 * @returns {Function_Instance}
	 */
	getFunction (access, signature) {
		if (!Array.isArray(access)) {
			throw new Error(`Unexpected access type`);
		}

		return this.getFile().getFunction(access, signature);
	}

	getType(node) {
		switch (node.type) {
			case "data_type":
			case "access":
				break;
			default:
				throw new Error(`Unexpected syntax node with type "${node.type}"`);
		}

		let access = [
			node.value[1],
			...node.value[2].value.map(x => this.resolveTemplate(x))
		];
		if (access.includes(null)) {
			return null;
		}

		let type = this.ctx.getType(access);

		if (node.value[0].value == "@") {
			type.constant = false;
			type.lent = true;
		} else if (node.value[0].value == "$") {
			type.constant = true;
			type.lent = true;
		}

		return type;
	}



	/**
	 * Resolves any dynamic access for the variable
	 * ALTERS original AST
	 * @param {SyntaxNode} ast
	 */
	resolveAccess (ast) {
		for (let access of ast.value) {
			if (access.type == "[]") {
				for (let i in access.value) {
					let res = this.compile_expr(access.value[i], null, true);
					if (res === null) {
						return {
							error: true,
							msg: `Error: Unexpected dynamic access operand type ${arg.type}`,
							ref: arg.ref
						};
					}

					access.value[i] = res;
				}
			}
		}

		return ast;
	}


	/**
	 *
	 * @param {BNF_Node} node type: access
	 */
	resolveTemplate (node) {
		switch (node.type) {
			case "access":
			case "variable":
			case "data_type":
				break;
			default:
				throw new Error(`Cannot resolve templates for ${node.type}`);
		}

		let access = node.value.map(x => {
			switch (x.type) {
				case "name":
				case "access_static":
					return x;
				case "access_template":
					return this.resolveTemplate_Argument(x);
				case "access_dynamic":
					this.getFile().throw(
						`Error: Dynamic access should not be present in a data type`,
						node.ref.start, node.ref.end
					);
					return x;
				default:
					throw new Error(`Unexpected access type ${x.type}`);
			}
		});

		if (access.includes(null)) {
			return null;
		}

		return access;
	}

	resolveTemplate_Argument (node) {
		let access = node.value.map(arg => {
			switch (arg.type) {
				case "data_type":
					var type = this.getType(arg);
					if (type === null) {
						this.getFile().throw(
							`Error: Unknown data type ${arg.flat()}`,
							arg.ref.start, arg.ref.end
						);
						return null;
					}

					return type;
				case "constant":
					var val = this.compile_constant(arg);
					return val;
				default:
					this.getFile().throw(
						`Error: ${arg.type} are currently unsupported in template arguments`,
						arg.ref.start, arg.ref.end
					);
					return null;
			}
		});

		if (access.includes(null)) {
			return null;
		}

		return new SyntaxNode(
			node.type,
			access,
			node.ref.clone()
		);
	}






	/**
	 * Get a register
	 * @param {SyntaxNode} ast
	 * @param {Boolean} read
	 */
	getVar (ast, read = true) {
		let preamble = new LLVM.Fragment();

		// Link dynamic access arguments
		ast = this.resolveAccess(ast);
		let res = this.scope.getVar(ast, read);

		// Inject reference if it is missing
		if (res.error) {
			res.ref = res.ref || ast.ref;
			return res;
		}

		let accesses = ast.value.slice(1);
		for (let access of accesses) {
			res.hasUpdated = res.hasUpdated || !read;
			res = res.access(access);
			if (res.error) {
				return res;
			}
			preamble.merge(res.preamble);
			res = res.variable;
		}

		return {
			preamble: preamble,
			variable: res
		};
	}

	compile_loadVariable (ast) {
		let preamble = new LLVM.Fragment();
		let target = this.getVar (ast);
		if (target.error) {
			return target;
		}
		preamble.merge(target.preamble);
		target = target.variable;

		let out = target.read(ast.ref);
		if (out.error) {
			return out;
		}
		preamble.merge(out.preamble);

		if (out.register instanceof LLVM.GEP) {
			throw new Error ("Bad code path");
		}

		return {
			preamble: preamble,
			epilog: new LLVM.Fragment(),
			type: out.type,
			instruction: out.register
		};
	}





	sync (branches, segment, ref){
		return this.scope.sync(
			branches,
			segment,
			ref
		);
	}

	/**
	 * Trigger falling out of scope behaviour for all variables
	 * @param {BNF_Reference} ref
	 * @returns {LLVM.Fragment|Error}
	 */
	cleanup (ref) {
		return this.scope.cleanup(ref);
	}
}

module.exports = ExecutionBase;
