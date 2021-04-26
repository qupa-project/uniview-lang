const Register = require('../memory/variable.js');
const Scope = require('../memory/scope.js');

const Flattern = require('../../parser/flattern.js');
const LLVM     = require("../../middle/llvm.js");
const TypeRef  = require('../typeRef.js');

const Primative = {
	types: require('../../primative/types.js')
};

const ExecutionFlow = require('./flow.js');
const Structure = require('../struct.js');

class Execution extends ExecutionFlow {

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
		frag.merge(access.preamble);
		access = access.variable;


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

		let chg = access.markUpdated(expr.instruction, false, ast.ref);
		if (chg.error) {
			this.getFile().throw(chg.msg, chg.ref.start, chg.ref.end);
			return null;
		}

		frag.merge(expr.epilog);
		return frag;
	}

	compile_declare (ast) {
		let	name = ast.tokens[1].tokens;

		let typeRef = this.resolveType(ast.tokens[0]);
		if (!(typeRef instanceof TypeRef)) {
			this.getFile().throw(`Error: Invalid type name "${Flattern.DataTypeStr(ast.tokens[0])}"`, ast.ref.start, ast.ref.end);
			return null;
		}
		typeRef.localLife = ast.tokens[0];

		// Complex types are handled by address, not value
		if (typeRef.type.typeSystem == "linear" || typeRef.type instanceof Array) {
			typeRef.pointer++;
		}

		this.scope.register_Var(
			typeRef,
			name,
			ast.ref.start
		);

		return new LLVM.Fragment();
	}

	/**
	 * Generates the LLVM for the combined action of define + assign
	 * @param {BNF_Node} ast
	 * @returns {LLVM.Fragment}
	 */
	compile_declare_assign (ast) {
		let frag = new LLVM.Fragment();

		// If there is a goal type
		//   Get the goal type
		let targetType = null;
		if (ast.tokens[0] !== null) {
			targetType = this.resolveType(ast.tokens[0]);
			if (!(targetType instanceof TypeRef)) {
				this.getFile().throw(`Error: Invalid type name "${
					Flattern.DataTypeStr(ast.tokens[0])
				}"`, ast.ref.start, ast.ref.end);
				return null;
			}
		}



		// Compile the expression
		let expr = this.compile_expr(ast.tokens[2], targetType, true);
		if (expr === null) {
			return null;
		}
		frag.merge(expr.preamble);

		// If the type was not given, extract it from the expression
		if (targetType === null) {
			targetType = expr.type;
		}

		// Declare the variable and assign it to the expression result
		let variable = this.scope.register_Var(
			targetType,             // type
			ast.tokens[1].tokens,   // name
			ast.ref.start           // ref
		);
		let chg = variable.markUpdated(expr.instruction, false, ast.ref);
		if (chg.error) {
			this.getFile().throw(chg.msg, chg.ref.start, chg.ref.end);
			return null;
		}


		frag.merge(expr.epilog);
		return frag;
	}




	/**
	 * Generates the LLVM for a call
	 * Used in other compile functions
	 * @param {BNF_Node} ast
	 */
	compile_call (ast) {
		let instruction = null;
		let preamble    = new LLVM.Fragment();
		let epilog      = new LLVM.Fragment();
		let returnType    = null;


		// Get argument types
		//  and generate LLVM for argument inputs
		//  also add any preamble to get the arguments
		let file = this.getFile();
		let signature = [];
		let args = [];
		let regs = [];
		for (let arg of ast.tokens[2].tokens) {
			let expr = this.compile_expr(arg, null, true);
			if (expr === null) {
				return null;
			} else if (expr.error == true) {
				file.throw ( expr.msg, expr.ref.start, expr.ref.end );
				return null;
			}

			preamble.merge(expr.preamble);
			epilog.merge(expr.epilog);

			args.push(expr.instruction);
			signature.push(expr.type);

			if (expr.register instanceof Register) {
				preamble.merge(expr.register.flushCache());
				regs.push(expr.register);
			}
		}

		// Link any [] accessors
		let accesses = [ ast.tokens[0].tokens[1].tokens ];
		for (let access of ast.tokens[0].tokens[2]) {
			if (access[0] == "[]") {
				file.throw (
					`Error: Class base function execution is currently unsupported`,
					inner.ref.start, inner.ref.end
				);
				return null;
			} else {
				accesses.push([access[0], access[1].tokens]);
			}
		}


		// Link any template access
		let template = this.resolveTemplate(ast.tokens[1]);
		if (template === null) {
			return null;
		}

		// Find a function with the given signature
		let target = this.getFunction(accesses, signature, template);
		if (!target) {
			let funcName = Flattern.VariableStr(ast.tokens[0]);
			file.throw(
				`Error: Unable to find function "${funcName}" with signature (${signature.join(", ")})`,
				ast.ref.start, ast.ref.end
			);
			return null;
		}

		let complex = !target.isInline &&
			target.returnType.type.typeSystem == "linear";
		let callVal;
		if (complex) {
			let id = new LLVM.ID();
			preamble.append(new LLVM.Set(
				new LLVM.Name(id, false, ast.ref),
				new LLVM.Alloc(target.returnType.duplicate().offsetPointer().toLLVM(), ast.ref),
				ast.ref
			));

			callVal = new LLVM.Name(id.reference(), false, ast.ref);

			args = [
				new LLVM.Argument(
					target.returnType.toLLVM(ast.ref),
					callVal
				),
				...args
			];
		}

		if (target.isInline) {
			let inner = target.generate(regs, args);
			preamble.merge(inner.preamble);

			instruction = inner.instruction;
			returnType = inner.type;
		} else {
			instruction = new LLVM.Call(
				complex ?
					new LLVM.Type("void", 0, ast.ref) :
					target.returnType.toLLVM(ast.ref),
				new LLVM.Name(target.represent, true, ast.tokens[0].ref),
				args,
				ast.ref.start
			);
			returnType = target.returnType;
		}


		// Complex functions do not return real values
		// Instead the result is stored in the first argument
		if (complex) {
			preamble.append(instruction);
			instruction = new LLVM.Argument(
				target.returnType.toLLVM(),
				callVal
			);
		}

		return { preamble, instruction, epilog, type: returnType };
	}

	/**
	 * Generates the LLVM for a call where the result is ignored
	 * @param {BNF_Reference} ast
	 * @returns {LLVM.Fragment}
	 */
	compile_call_procedure (ast) {
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





	compile_decompose (ast) {
		let frag = new LLVM.Fragment();

		let target = this.getVar(ast.tokens[0], true);
		if (target.error) {
			this.getFile().throw( target.msg, target.ref.start, target.ref.end );
			return null;
		}
		frag.append(target.preamble);
		target = target.variable;

		let res = target.decompose(ast.ref);

		/* jshint ignore:start*/
		if (res?.error) {
			this.getFile().throw( res.msg, res.ref.start, res.ref.end);
			return null;
		}
		/* jshint ignore:end*/

		frag.append(res);
		return frag;
	}
	compile_compose (ast) {
		let frag = new LLVM.Fragment();

		let target = this.getVar(ast.tokens[0], true);
		if (target.error) {
			this.getFile().throw( target.msg, target.ref.start, target.ref.end );
			return null;
		}
		frag.append(target.preamble);
		target = target.variable;

		let res = target.compose(ast.ref);
		if (res.error) {
			this.getFile().throw( res.msg, res.ref.start, res.ref.end);
			return null;
		}
		frag.append(res);

		return frag;
	}






	compile_return (ast){
		let frag = new LLVM.Fragment();
		let inner = null;

		// Get the return result in LLVM.Argument form
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
			if (returnType.type.typeSystem == "linear") {
				// Structures are parsed by pointer

				let sizePtrID = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(sizePtrID, false, ast.ref),
					new LLVM.GEP(
						returnType.duplicate().offsetPointer(-1).toLLVM(),
						new LLVM.Argument(
							returnType.duplicate().toLLVM(),
							new LLVM.Constant("null", ast.ref),
							ast.ref
						),
						[new LLVM.Argument(
							new LLVM.Type("i64", 0, ast.ref),
							new LLVM.Constant("1", ast.ref),
							ast.ref
						)]
					)
				));

				let sizeID = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(sizeID, false, ast.ref),
					new LLVM.PtrToInt(
						new LLVM.Type("i64", 0),
						new LLVM.Argument(
							returnType.duplicate().toLLVM(),
							new LLVM.Name(sizePtrID.reference(), false, ast.ref),
							ast.ref
						)
					)
				));

				let fromID = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(fromID, false),
					new LLVM.Bitcast(
						new LLVM.Type("i8", 1),
						res.instruction
					)
				));
				let toID = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(toID, false),
					new LLVM.Bitcast(
						new LLVM.Type("i8", 1),
						new LLVM.Argument(
							returnType.toLLVM(),
							new LLVM.Name("0", false, ast.ref),
							ast.ref
						)
					)
				));

				frag.append(new LLVM.Call(
					new LLVM.Type("void", 0),
					new LLVM.Name("llvm.memmove.p0i8.p0i8.i64", true),
					[
						new LLVM.Argument(
							new LLVM.Type("i8", 1),
							new LLVM.Name(toID.reference(), false)
						),
						new LLVM.Argument(
							new LLVM.Type("i8", 1),
							new LLVM.Name(fromID.reference(), false)
						),
						new LLVM.Argument(
							new LLVM.Type("i64", 0),
							new LLVM.Name(sizeID.reference(), false)
						),
						new LLVM.Argument(
							new LLVM.Type('i1', 0),
							new LLVM.Constant("0")
						)
					]
				));

				inner = new LLVM.Type("void", 0, ast.ref);
			} else {
				inner = res.instruction;
			}

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

		// Clean up the scope
		let res = this.scope.cleanup(ast.ref);
		if (res.error) {
			this.getFile().throw(res.msg, res.ref.start, res.ref.end);
			return null;
		}
		frag.append(res);

		frag.append(new LLVM.Return(inner, ast.ref.start));
		this.returned = true;
		return frag;
	}





	compile (ast) {
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
				case "declare_assign":
					inner = this.compile_declare_assign(token);
					break;
				case "return":
					inner = this.compile_return(token);
					break;
				case "call":
					inner = this.compile_call_procedure(token);
					break;
				case "if":
					inner = this.compile_if(token);
					break;
				case "compose":
					inner = this.compile_compose(token);
					break;
				case "decompose":
					inner = this.compile_decompose(token);
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
	clone () {
		let scope = this.scope.clone();
		let out = new Execution(this, this.returnType, scope);
		out.isChild = true;
		return out;
	}
}


module.exports = Execution;