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
			case "call":
				res = this.compile_call(ast);
				break;
			case "variable":
				res = this.compile_loadVariable(ast);
				break;
			case "expr_arithmetic":
				res = this.compile_expr_arithmetic(ast.tokens[0]);
				break;
			case "expr_compare":
				res = this.compile_expr_compare(ast.tokens[0]);
				break;
			case "expr_bool":
				res = this.compile_expr_bool(ast.tokens[0]);
				break;
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

	compile_expr_opperand (ast) {
		switch (ast.type) {
			case "variable":
				return this.compile_loadVariable(ast);
			case "constant":
				return this.compile_constant(ast);
			default:
				throw new Error(`Unexpected expression opperand type ${ast.type}`);
		}
	}


	compile_expr_arithmetic(ast) {
		let action = null;
		switch (ast.type) {
			case "expr_add":
				action = "Add";
				break;
			case "expr_sub":
				action = "Sub";
				break;
			case "expr_mul":
				action = "Mul";
				break;
			case "expr_div":
				action = "Div";
				break;
			case "expr_mod":
				action = "Rem";
				break;
			default:
				throw new Error(`Unexpected arithmetic expression type ${ast.type}`);
		}



		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();

		// Load the two operands ready for operation
		let opperands = [
			this.compile_expr_opperand(ast.tokens[0]),
			this.compile_expr_opperand(ast.tokens[2])
		];


		// Append the load instructions
		preamble.merge(opperands[0].preamble);
		preamble.merge(opperands[1].preamble);

		// Append the cleanup instructions
		epilog.merge(opperands[0].epilog);
		epilog.merge(opperands[1].epilog);



		// Check opperands are primatives
		if (!opperands[0].type.type.primative) {
			this.getFile().throw(
				`Error: Cannot run arithmetic opperation on non-primative type`,
				ast.tokens[0].ref.start, ast.tokens[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.type.primative) {
			this.getFile().throw(
				`Error: Cannot run arithmetic opperation on non-primative type`,
				ast.tokens[2].ref.start, ast.tokens[2].ref.end
			);
			return null;
		}


		// Check opperands are the same type
		if (!opperands[0].type.match(opperands[1].type)) {
			this.getFile().throw(
				`Error: Cannot perform arithmetic opperation on unequal types`,
				ast.tokens[0].ref.start, ast.tokens[2].ref.end
			);
			return null;
		}


		// Get the arrithmetic mode
		let mode = null;
		if (opperands[0].type.type.cat == "int") {
			mode = opperands[0].type.type.signed ? 0 : 1;
		} else if (opperands[0].type.type.cat == "float") {
			mode = 2;
		}
		if (mode === null) {
			this.getFile().throw(
				`Error: Unable to perform arithmetic opperation for unknown reason`,
				ast.tokens[1].ref.start, ast.tokens[1].ref.end
			);
			return null;
		}

		return {
			preamble, epilog,
			instruction: new LLVM[action](
				mode,
				opperands[0].instruction.type,
				opperands[0].instruction.name,
				opperands[1].instruction.name
			),
			type: opperands[0].type
		};
	}

	compile_expr_compare(ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();


		// Load the two operands ready for operation
		let opperands = [
			this.compile_expr_opperand(ast.tokens[0]),
			this.compile_expr_opperand(ast.tokens[2])
		];


		// Check opperands are primatives
		if (!opperands[0].type.type.primative) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on non-primative type`,
				ast.tokens[0].ref.start, ast.tokens[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.type.primative) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on non-primative type`,
				ast.tokens[2].ref.start, ast.tokens[2].ref.end
			);
			return null;
		}


		// Check opperands are the same type
		if (!opperands[0].type.match(opperands[1].type)) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on unequal types`,
				ast.tokens[0].ref.start, ast.tokens[2].ref.end
			);
			return null;
		}


		// Get the arrithmetic mode
		let mode = null;
		if (opperands[0].type.type.cat == "int") {
			mode = opperands[0].type.type.signed ? 0 : 1;
		} else if (opperands[0].type.type.cat == "float") {
			mode = 2;
		}
		if (mode === null) {
			this.getFile().throw(
				`Error: Unable to perform comparison opperation for unknown reason`,
				ast.tokens[1].ref.start, ast.tokens[1].ref.end
			);
			return null;
		}


		let cond = null;
		switch (ast.type) {
			case "expr_eq":
				cond = mode == 2 ? "oeq" : "eq";
				break;
			case "expr_neq":
				cond = mode == 2 ? "une" : "ne";
				break;
			case "expr_gt":
				cond = mode == 0 ? "ugt" :
					mode == 1 ? "sgt" :
					"ogt";
				break;
			case "expr_gt_eq":
				cond = mode == 0 ? "uge" :
					mode == 1 ? "sge" :
					"oge";
				break;
			case "expr_lt":
				cond = mode == 0 ? "ult" :
					mode == 1 ? "slt" :
					"olt";
				break;
			case "expr_lt_eq":
				cond = mode == 0 ? "ule" :
					mode == 1 ? "sle" :
					"ole";
				break;
			default:
				throw new Error(`Unexpected comparison expression type ${ast.type}`);
		}


		// Append the load instructions
		preamble.merge(opperands[0].preamble);
		preamble.merge(opperands[1].preamble);

		// Append the cleanup instructions
		epilog.merge(opperands[0].epilog);
		epilog.merge(opperands[1].epilog);



		return {
			preamble, epilog,
			instruction: new LLVM.Compare(
				mode,
				cond,
				opperands[0].instruction.type,
				opperands[0].instruction.name,
				opperands[1].instruction.name
			),
			type: new TypeRef(0, Primative.types.bool)
		};
	}

	compile_expr_bool(ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();


		let opperands = [];
		let action = null;
		let type = new TypeRef(0, Primative.types.bool);
		switch (ast.type) {
			case "expr_and":
			case "expr_or":
				action = ast.type == "expr_and" ? "And" : "Or";
				opperands = [
					this.compile_expr_opperand(ast.tokens[0]),
					this.compile_expr_opperand(ast.tokens[2])
				];
				break;
			case "expr_not":
				action = "XOr";
				opperands = [
					this.compile_expr_opperand(ast.tokens[0]),
					{
						preamble: new LLVM.Fragment(),
						epilog: new LLVM.Fragment(),
						instruction: new LLVM.Constant("true"),
						type
					}
				];
				break;
			default:
				throw new Error(`Unexpected boolean expression type ${ast.type}`);
		}


		// Check opperands are of boolean type
		if (!opperands[0].type.match(type)) {
			this.getFile().throw(
				`Error: Cannot perform boolean opperation on non boolean types`,
				ast.tokens[0].ref.start, ast.tokens[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.match(type)) {
			this.getFile().throw(
				`Error: Cannot perform boolean opperation on non boolean types`,
				ast.tokens[2].ref.start, ast.tokens[2].ref.end
			);
			return null;
		}


		// Append the load instructions
		preamble.merge(opperands[0].preamble);
		preamble.merge(opperands[1].preamble);

		// Append the cleanup instructions
		epilog.merge(opperands[0].epilog);
		epilog.merge(opperands[1].epilog);


		let instruction = new LLVM[action](
			opperands[0].instruction.type,
			opperands[0].instruction.name,
			action == "XOr" ? opperands[1].instruction : opperands[1].instruction.name
		);

		return {
			preamble, epilog,
			instruction,
			type
		};
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
		this.returned = true;
		return frag;
	}




	/**
	 * Generates the LLVM for a call where the result is ignored
	 * @param {BNF_Reference} ast
	 * @returns {LLVM.Fragment}
	 */
	compile_call_procedure(ast) {
		let frag = new LLVM.Fragment(ast);
		let out = this.compile_call(ast);
		if (out === null) {
			return null;
		}

		// Merge the preable, execution, and epilog into one fragment
		frag.merge(out.preamble);
		frag.append(out.instruction);
		frag.merge(out.epilog);
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
				case "call":
					inner = this.compile_call_procedure(token);
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
