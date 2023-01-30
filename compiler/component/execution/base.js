const LLVM     = require("../../middle/llvm.js");
const TypeRef = require('../typeRef.js');
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
		return this.ctx.getType(node);
	}






	/**
	 * Get a register
	 * @param {SyntaxNode} ast
	 * @param {Boolean} read
	 */
	getVar (ast, read = true) {
		let preamble = new LLVM.Fragment();

		// Link dynamic access arguments
		let res = this.scope.getVar(ast, read);

		// Inject reference if it is missing
		if (res.error) {
			res.ref = res.ref || ast.ref;
			return res;
		}

		let accesses = ast.value.slice(1);
		for (let access of accesses) {
			res.hasUpdated = res.hasUpdated || !read;
			res = res.access(access.value, access.ref);
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





	sync (branches, ref){
		return this.scope.sync(
			branches,
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
