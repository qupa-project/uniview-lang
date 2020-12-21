const Constant = require('./memory/constant.js');
const Register = require('./memory/variable.js');
const Scope = require('./memory/scope.js');

const Flattern = require('../parser/flattern.js');
const LLVM     = require("../middle/llvm.js");
const TypeRef  = require('./typeRef.js');
const { Name } = require('../middle/llvm.js');

const Primative = {
	types: require('./../primative/types.js')
};

class Execution {
	/**
	 *
	 * @param {Function|Execution} ctx
	 * @param {*} returnType
	 * @param {*} scope
	 */
	constructor(ctx, returnType, scope, entryPoint = new LLVM.ID()) {
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
	getFunction(access, signature, template) {
		return this.getFile().getFunction(access, signature, template);
	}

	getFunctionGroup () {
		return this.ctx.getFunctionGroup();
	}
	getFunctionInstance() {
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
	getParent() {
		if (this.ctx instanceof Execution) {
			return this.ctx;
		}
		return null;
	}






	/**
	 * Get a register
	 * @param {*} ast
	 * @param {Boolean} read
	 */
	getVar(ast) {
		// Link dynamic access arguments
		ast = this.resolveAccess(ast);

		let res = this.scope.getVar(ast);

		// Inject reference if it is missing
		if (res.error) {
			res.ref = res.ref || ast.ref;
		}

		return res;
	}

	compile_loadVariable(ast) {
		let target = this.getVar(ast);

		if (target.error) {
			return target;
		}

		let out = target.read(ast.ref);
		if (out.error) {
			return out;
		}

		return {
			preamble: out.preamble,
			epilog: new LLVM.Fragment(),
			type: out.type,
			instruction: out.instruction
		};
	}

	/**
	 *
	 * @param {BNF_Node} node
	 */
	resolveType (node) {
		// let template = this.resolveTemplate(node.tokens[3]);
		// if (template === null) {
		// 	return null;
		// }

		return this.getFile().getType(
			Flattern.DataTypeList(node),
			null
		);
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






	/**
	 * Generates the LLVM for a constant
	 * Used in other compile functions
	 * @param {BNF_Node} ast
	 */
	compile_constant(ast) {
		let preamble = new LLVM.Fragment();
		let type = null;
		let val = null;
		switch (ast.tokens[0].type) {
			case "float":
				type = new TypeRef(0, Primative.types.float);
				val = new LLVM.Constant(
					ast.tokens[0].tokens,
					ast.ref.start
				);
				break;
			case "boolean":
				type = new TypeRef(0, Primative.types.bool);
				val = new LLVM.Constant(
					val == "true" ? 1 : 0,
					ast.ref.start
				);
				break;
			case "integer":
				type = new TypeRef(0, Primative.types.i32);
				val = new LLVM.Constant(
					ast.tokens[0].tokens,
					ast.ref.start
				);
				break;
			case "string":
				let bytes = ast.tokens[0].tokens[1].length + 1;
				let str = ast.tokens[0].tokens[1].replace(/\"/g, "\\22").replace(/\n/g, '\\0A') + "\\00";

				let ir_t1 = new LLVM.Type(`[ ${bytes} x i8 ]`, 0, ast.ref);
				let ir_t2 = new LLVM.Type(`i8`, 1);

				let str_id = new LLVM.ID();
				let ptr_id = new LLVM.ID();

				preamble.append(new LLVM.Set(
					new LLVM.Name(str_id, false, ast.ref),
					new LLVM.Alloc(
						ir_t1,
						ast.ref
					),
					ast.ref
				));
				preamble.append(new LLVM.Store(
					new LLVM.Argument(
						new LLVM.Type(`[ ${bytes} x i8 ]*`, 0, ast.ref),
						new LLVM.Name(str_id.reference(), false, ast.ref),
						ast.ref, "#str_const"
					),
					new LLVM.Argument(
						ir_t1,
						new LLVM.Constant(`c"${str}"`, ast.ref),
						ast.ref
					)
				));
				preamble.append(new LLVM.Set(
					new LLVM.Name(ptr_id, false, ast.ref),
					new LLVM.Bitcast(
						ir_t2,
						new LLVM.Argument(
							new LLVM.Type(`[ ${bytes} x i8 ]*`, 0, ast.ref),
							new LLVM.Name(str_id.reference(), false, ast.ref),
							ast.ref, "#str_const"
						),
						ast.ref
					),
					ast.ref
				));

				type = new TypeRef(1, Primative.types.i8);
				val = new Name(ptr_id, false, ast.ref);
				break;
			default:
				throw new Error(`Unknown constant type ${ast.tokens[0].type}`);
		}

		return {
			instruction: new LLVM.Argument(
				new LLVM.Type(type.type.represent, type.pointer, ast.ref.start),
				val,
				ast.ref
			),
			preamble,
			epilog: new LLVM.Fragment(),
			type: type,
		};
	}





	compile_declare(ast) {
		let	name = ast.tokens[2].tokens;
		let frag = new LLVM.Fragment();

		let typeRef = this.resolveType(ast.tokens[1]);
		typeRef.localLife = ast.tokens[0];
		if (!(typeRef instanceof TypeRef)) {
			this.getFile().throw(`Error: Invalid type name "${Flattern.DataTypeStr(ast.tokens[0])}"`, ast.ref.start, ast.ref.end);
			return null;
		}

		this.scope.register_Var(
			typeRef,
			name,
			ast.ref.start
		);

		return new LLVM.Fragment();
	}




	/**
	 *
	 * @param {BNF_Node} ast
	 * @param {Array[Number, TypeDef]} expects
	 * @param {Boolean} simple Simplifies the result to a single register when possible
	 */
	compile_expr (ast, expects = null, simple = false) {
		let res = null;
		switch (ast.type) {
			case "constant":
				res = this.compile_constant(ast);
				break;
			// case "call":
			// 	if (block) {
			// 		recursiveFail = true;
			// 		break;
			// 	}

			// 	res = this.compile_call(ast);
			// 	break;
			case "variable":
				res = this.compile_loadVariable(ast);
				break;
			// case "expr_arithmetic":
			// 	res = this.compile_expr_arithmetic(ast.tokens[0]);
			// 	break;
			// case "expr_compare":
			// 	res = this.compile_expr_compare(ast.tokens[0]);
			// 	break;
			// case "expr_bool":
			// 	res = this.compile_expr_bool(ast.tokens[0]);
			// 	break;
			default:
				throw new Error(`Unexpected expression type ${ast.type}`);
		}

		if (res.error) {
			this.getFile().throw( res.msg, res.ref.start, res.ref.end );
			return null;
		}

		if (res === null) {
			return null;
		}

		if (expects instanceof TypeRef && !expects.match(res.type)) {
			this.getFile().throw(
				`Error: Type miss-match, ` +
					`expected ${expects.toString()}, ` +
					`instead got ${res.type.toString()}`,
				ast.ref.start, ast.ref.end
			);
			return null;
		}

		/**
		 * Simplify result to a single register when;
		 *   - Simplifying is specified
		 *   - The value is not a constant
		 *   - The expected type is known
		 */
		if (
			simple &&
			!( res.instruction instanceof LLVM.Argument )
		) {
			let inner = res.instruction;
			let irType = null;
			if (expects) {
				irType = new LLVM.Type(expects.type.represent, expects.pointer, ast.ref.start)
			} else {
				if (!res.type) {
					throw new Error("Error: Cannot simplify due to undeduceable type");
				}
				irType = res.type;
			}

			res.register = new Register(res.type, "temp", ast.ref.start);
			let regIR = res.register.toLLVM();

			res.preamble.append(new LLVM.Set(
				regIR.name,
				inner,
				ast.ref.start
			));
			res.instruction = regIR;
		}

		res.ref = ast.ref;
		return res;
	}




	/**
	 * Generates the LLVM for assigning a variable
	 * @param {BNF_Node} ast
	 * @returns {LLVM.Fragment}
	 */
	compile_assign (ast) {
		let frag = new LLVM.Fragment();


		// Load the target variable
		//   This must occur after the expression is resolve
		//   because this variable now needs to be accessed for writing
		//   after any reads that might have taken place in the expresion
		let access = this.getVar(ast.tokens[0], false);
		if (access.error) {
			this.getFile().throw( access.msg, access.ref.start, access.ref.end );
			return null;
		}
		

		// Resolve the expression
		let expr = this.compile_expr(ast.tokens[1], access.type, true);
		if (expr === null) {
			return null;
		}
		frag.merge(expr.preamble);

		let targetType = access.type;
		if (!expr.type.match(targetType)) {
			this.getFile().throw(
				`Error: Assignment type mis-match` +
				` cannot assign ${targetType.toString()}` +
				` to ${expr.type.toString()}`,
				ast.ref.start, ast.ref.end
			);
			return null;
		}

		access.markUpdated(expr.instruction);
		frag.merge(expr.epilog);
		return frag;
	}




	compile_return(ast){
		let frag = new LLVM.Fragment();
		let inner = null;

		this.returned = true;
		let returnType = null;
		if (ast.tokens.length == 0){
			inner = new LLVM.Type("void", false);
			returnType = new TypeRef(0, Primative.types.void);
		} else {
			let res = this.compile_expr(ast.tokens[0], this.returnType, true);
			if (res === null) {
				return null;
			}
			returnType = res.type;
			frag.merge(res.preamble);
			inner = res.instruction;

			if (res.epilog.stmts.length > 0) {
				throw new Error("Cannot return using instruction with epilog");
			}
		}

		if (!this.returnType.match(returnType)) {
			this.getFile().throw(
				`Return type miss-match, expected ${this.returnType.toString()} but got ${returnType.toString()}`,
				ast.ref.start, ast.ref.end
			);
		}

		frag.append(new LLVM.Return(inner, ast.ref.start));
		return frag;
	}





	compile(ast) {
		let fragment = new LLVM.Fragment();
		let returnWarned = false;
		let failed = false;
		let inner = null;
		for (let token of ast.tokens) {
			if (this.returned && !returnWarned) {
				this.getFile().throw(
					`Warn: This function has already returned, this line and preceeding lines will not execute`,
					token.ref.start, token.ref.end
				);
				returnWarned = true;
				break;
			}

			switch (token.type) {
				case "declare":
					inner = this.compile_declare(token);
					break;
				case "assign":
					inner = this.compile_assign(token);
					break;
				case "return":
					inner = this.compile_return(token);
					break;
				default:
					this.getFile().throw(
						`Unexpected statment ${token.type}`,
						token.ref.start, token.ref.end
					);
			}

			if (inner instanceof LLVM.Fragment) {
				fragment.merge(inner);
			} else {
				failed = true;
				break;
			}
		}

		if (!failed && this.returned == false && !this.isChild) {
			this.getFile().throw(
				`Function does not return`,
				ast.ref.start, ast.ref.end
			);
		}

		return fragment;
	}





	/**
	 * Deep clone
	 * @returns {Scope}
	 */
	clone() {
		let scope = this.scope.clone();
		let out = new Execution(this, this.returnType, scope);
		out.isChild = true;
		return out;
	}

	/**
	 * Clears the cache of every
	 */
	clearAllCaches() {
		return this.scope.clearAllCaches();
	}

	flushAllClones() {
		return this.scope.flushAllClones();
	}

	/**
	 * Updates any caches due to alterations in child scope
	 * @param {Execution[]} child the scope to be merged
	 * @param {Boolean} alwaysExecute If this scope will always execute and is non optional (i.e. not if statement)
	 * @returns {LLVM.Fragment[]}
	 */
	mergeUpdates(children) {
		if ( !Array.isArray(children) || children.length < 1) {
			throw new Error("Cannot merge a zero children");
		}

		// Synchornise this scope to others
		let output = this.scope.syncScopes(
			children.map( x => x.scope ),
			children.map( x => x.entryPoint )
		);


		// Determine definite return
		let allReturned = true;
		for (let child of children) {
			if (child.returned == false) {
				allReturned = false;
				break;
			}
		}
		this.returned = allReturned;



		return output;
	}
}

module.exports = Execution;
