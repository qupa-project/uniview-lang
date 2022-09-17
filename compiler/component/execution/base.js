const Flattern = require('../../parser/flattern.js');
const LLVM     = require("../../middle/llvm.js");
const TypeRef = require('../typeRef.js');

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

	/**
	 * Return the function this scope is within
	 * @returns {Function_Instance}
	 */
	getFunction (access, signature, template) {
		return this.getFile().getFunction(access, signature, template);
	}

	getType(node, template) {
		return this.ctx.getType(node, template);
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
	 *
	 * @param {BNF_Node} node
	 */
	resolveTemplate (node) {
		let template = [];
		for (let arg of node.tokens) {
			switch (arg.type) {
				case "data_type":
					let type = this.ctx.getType(
						Flattern.DataTypeList(arg),
						this.resolveTemplate(arg.tokens[3])
					);
					if (type === null) {
						this.getFile().throw(
							`Error: Unknown data type ${Flattern.DataTypeStr(arg)}`,
							arg.ref.start, arg.ref.end
						);
						return null;
					}

					// Update pointer size
					type.pointer = arg.tokens[0];

					template.push(type);
					break;
				case "constant":
					let cnst = this.compile_constant(arg);
					if (cnst.type.type == Primative.types.void) {
						template.push(new TypeRef(0, Primative.types.void, false, false));
					} else {
						template.push(cnst);
					}
					break;
				default:
					this.getFile().throw(
						`Error: ${arg.type} are currently unsupported in template arguments`,
						arg.ref.start, arg.ref.end
					);
					return null;
			}
		}

		return template;
	}






	/**
	 * Get a register
	 * @param {*} ast
	 * @param {Boolean} read
	 */
	getVar (ast, read = true) {
		let preamble = new LLVM.Fragment();

		// Link dynamic access arguments
		ast = this.resolveAccess (ast);
		let res = this.scope.getVar (ast, read);

		// Inject reference if it is missing
		if (res.error) {
			res.ref = res.ref || ast.ref;
			return res;
		}

		let accesses = ast.tokens[2];
		for (let access of accesses) {
			res.hasUpdated = res.hasUpdated || !read;
			res = res.access(access[1].tokens, access[1].ref);
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



	/**
	 *
	 * @param {BNF_Node} node
	 */
	resolveType (node) {
		let template = this.resolveTemplate(node.tokens[3]);
		if (template === null) {
			return null;
		}

		let type = this.ctx.getType(
			Flattern.DataTypeList(node),
			template
		);

		return type;
	}

	/**
	 * Resolves any dynamic access for the variable
	 * ALTERS original AST
	 * @param {*} ast
	 */
	resolveAccess (ast) {
		for (let access of ast.tokens[2]) {
			if (access[0] == "[]") {
				for (let i in access[1]) {
					let res = this.compile_expr(access[1][i], null, true);
					if (res === null) {
						return {
							error: true,
							msg: `Error: Unexpected dynamic access opperand type ${arg.type}`,
							ref: arg.ref
						};
					}

					access[1][i] = res;
				}
			}
		}

		return ast;
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
