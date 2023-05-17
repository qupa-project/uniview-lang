const LLVM     = require("../../middle/llvm.js");
const TypeRef  = require('../typeRef.js');
const Structure = require('../struct.js');

const Flatten = require('../../parser/flatten.js');

const Primative = {
	types: require('../../primative/types.js')
};


const ExecutionBase = require('./base.js');

class ExecutionExpr extends ExecutionBase {

	/**
	 * Generates the LLVM for a constant
	 * Used in other compile functions
	 * @param {BNF_Node} ast
	 */
	compile_constant (ast) {
		let preamble = new LLVM.Fragment();
		let type = null;
		let val = null;

		switch (ast.value[0].type) {
			case "float":
				type = new TypeRef(Primative.types.double);
				val = new LLVM.Constant(
					ast.value[0].value,
					ast.ref.start
				);
				break;
			case "boolean":
				type = new TypeRef(Primative.types.bool);
				val = new LLVM.Constant(
					ast.value[0].value == "true" ? 1 : 0,
					ast.ref.start
				);
				break;
			case "void":
				type = new TypeRef(Primative.types.void);
				val = new LLVM.Constant(
					"null",
					ast.ref.start
				);
				break;
			case "integer":
				type = new TypeRef(Primative.types.i64);
				val = new LLVM.Constant(
					ast.value[0].value,
					ast.ref.start
				);
				break;
			case "string":
				let bytes = ast.value[0].value.length + 1;
				let str = ast.value[0].value.replace(/\"/g, "\\22").replace(/\n/g, '\\0A') + "\\00";

				let global = this.getFunctionInstance()
					.bindConst(`private unnamed_addr constant [ ${bytes} x i8 ] c"${str}"`, ast.value.ref);

				type = new TypeRef(Primative.types.cstring, true, true);
				let ptr_id = new LLVM.ID();

				preamble.append(new LLVM.Set(
					new LLVM.Name(ptr_id, false, ast.ref),
					new LLVM.Bitcast(
						type.toLLVM(),
						new LLVM.Argument(
							new LLVM.Type(`[ ${bytes} x i8 ]*`, 0, ast.ref),
							global,
							ast.ref, "#str_const"
						),
						ast.ref
					),
					ast.ref
				));

				val = new LLVM.Name(ptr_id, false, ast.ref);
				break;
			default:
				throw new Error(`Unknown constant type ${ast.value[0].type}`);
		}

		return {
			instruction: new LLVM.Argument(
				type.toLLVM(),
				val,
				ast.ref
			),
			preamble,
			epilog: new LLVM.Fragment(),
			type: type,
		};
	}

	compile_expr_opperand (ast) {
		switch (ast.type) {
			case "variable":
				return this.compile_loadVariable(ast);
			case "constant":
				return this.compile_constant(ast);
			case "expr_brackets":
				return this.compile_expr(ast.value[0], null, true);
			default:
				return this.compile_expr(ast, null, true)
		}
	}


	compile_expr_arithmetic (ast) {
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
			case "expr_invert":
				return this.compile_expr_arithmetic_invert(ast);
			default:
				throw new Error(`Unexpected arithmetic expression type ${ast.type}`);
		}

		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();

		// Load the two operands ready for operation
		let opperands = [
			this.compile_expr_opperand(ast.value[0]),
			this.compile_expr_opperand(ast.value[1])
		];

		// Catch any errors getting the opperands
		let hasErr = false;
		for (let opper of opperands) {
			if (opper == null) {
				hasErr = true;
			} else if (opper.error) {
				this.getFile().throw(opper.msg, opper.ref.start, opper.ref.end);
				hasErr = true;
			}
		}
		if (hasErr) {
			return null;
		}

		// Append the load instructions
		preamble.merge(opperands[0].preamble);
		preamble.merge(opperands[1].preamble);

		// Append the cleanup instructions
		epilog.merge(opperands[0].epilog);
		epilog.merge(opperands[1].epilog);

		// Check opperands are primatives
		if (!opperands[0].type.native) {
			this.getFile().throw(
				`Error: Cannot run arithmetic opperation on non-primative type`,
				ast.value[0].ref.start, ast.value[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.native) {
			this.getFile().throw(
				`Error: Cannot run arithmetic opperation on non-primative type`,
				ast.value[1].ref.start, ast.value[1].ref.end
			);
			return null;
		}


		// Check opperands are the same type
		if (!opperands[0].type.matchApprox(opperands[1].type)) {
			this.getFile().throw(
				`Error: Cannot perform arithmetic opperation on unequal types. ${opperands[0].type} != ${opperands[1].type}`,
				ast.value[0].ref.start, ast.value[1].ref.end
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
				ast.value[1].ref.start, ast.value[1].ref.end
			);
			return null;
		}

		let type = opperands[0].type.duplicate();
		type.lent = false;

		return {
			preamble, epilog,
			instruction: new LLVM[action](
				mode,
				opperands[0].instruction.type,
				opperands[0].instruction.name,
				opperands[1].instruction.name
			),
			type: type
		};
	}

	compile_expr_arithmetic_invert (ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();

		// Load the two operands ready for operation
		let opperand = this.compile_expr_opperand(ast.value[0]);

		// Catch any errors getting the opperands
		if (opperand.error) {
			this.getFile().throw(opperand.msg, opperand.ref.start, opperand.ref.end);
			return null;
		}

		// Append the load instructions
		preamble.merge(opperand.preamble);
		epilog.merge(opperand.epilog);


		// Check opperands are primatives
		if (!opperand.type.type.native) {
			this.getFile().throw(
				`Error: Cannot run arithmetic opperation on non-primative type`,
				ast.value[0].ref.start, ast.value[0].ref.end
			);
			return null;
		}


		// Get the arrithmetic mode
		let mode = null;
		if (opperand.type.type.cat == "int") {
			mode = opperand.type.type.signed ? 0 : 1;
		} else if (opperand.type.type.cat == "float") {
			mode = 2;
		}
		if (mode === null) {
			this.getFile().throw(
				`Error: Unable to perform arithmetic opperation for unknown reason`,
				ast.value[1].ref.start, ast.value[1].ref.end
			);
			return null;
		} else if (mode === 1) {
			this.getFile().throw(
				`Error: Cannot invert a non signed integer`,
				ast.value[1].ref.start, ast.value[1].ref.end
			);
			return null;
		}

		return {
			preamble, epilog,
			instruction: new LLVM.Sub(
				mode,
				opperand.instruction.type,
				new LLVM.Constant(
					mode == 2 ? "0.0" : 0
				),
				opperand.instruction.name
			),
			type: opperand.type
		};
	}

	compile_expr_compare (ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();


		// Load the two operands ready for operation
		let opperands = [
			this.compile_expr_opperand(ast.value[0]),
			this.compile_expr_opperand(ast.value[1])
		];


		// Catch any errors getting the opperands
		let hasErr = false;
		for (let opper of opperands) {
			if (opper == null) {
				hasErr = true;
			} else if (opper.error) {
				this.getFile().throw(opper.msg, opper.ref.start, opper.ref.end);
				hasErr = true;
			}
		}
		if (hasErr) {
			return null;
		}


		// Check opperands are primatives
		if (!opperands[0].type.type.native) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on non-primative type`,
				ast.value[0].ref.start, ast.value[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.type.native) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on non-primative type`,
				ast.value[1].ref.start, ast.value[1].ref.end
			);
			return null;
		}


		// Check opperands are the same type
		if (!opperands[0].type.match(opperands[1].type)) {
			this.getFile().throw(
				`Error: Cannot perform comparison opperation on unequal types. ${opperands[0].type} != ${opperands[1].type}`,
				ast.value[0].ref.start, ast.value[1].ref.end
			);
			return null;
		}


		// Get the arrithmetic mode
		let mode = null;
		if (opperands[0].type.type.cat == "int") {
			mode = opperands[0].type.type.signed ? 1 : 0;
		} else if (opperands[0].type.type.cat == "float") {
			mode = 2;
		} else if (opperands[0].type.type.represent == "i1") {
			mode = 1;
		}
		if (mode === null) {
			this.getFile().throw(
				`Error: Unable to perform comparison opperation for unknown reason`,
				ast.value[1].ref.start, ast.value[1].ref.end
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
			type: new TypeRef(Primative.types.bool)
		};
	}

	compile_expr_bool (ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();


		let opperands = [];
		let action = null;
		let type = new TypeRef(Primative.types.bool);
		switch (ast.type) {
			case "expr_and":
			case "expr_or":
				action = ast.type == "expr_and" ? "And" : "Or";
				opperands = [
					this.compile_expr_opperand(ast.value[0]),
					this.compile_expr_opperand(ast.value[1])
				];
				break;
			case "expr_not":
				action = "XOr";
				opperands = [
					this.compile_expr_opperand(ast.value[0]),
					{
						preamble: new LLVM.Fragment(),
						epilog: new LLVM.Fragment(),
						instruction: new LLVM.Constant("1"),
						type
					}
				];
				break;
			default:
				throw new Error(`Unexpected boolean expression type ${ast.type}`);
		}

		// Catch any errors getting the opperands
		let hasErr = false;
		for (let opper of opperands) {
			if (opper == null) {
				hasErr = true;
			} else if (opper.error) {
				this.getFile().throw(opper.msg, opper.ref.start, opper.ref.end);
				hasErr = true;
			}
		}
		if (hasErr) {
			return null;
		}


		// Check opperands are of boolean type
		if (!opperands[0].type.weakMatch(type)) {
			this.getFile().throw(
				`Error: Cannot perform boolean opperation on a boolean and non-boolean type`,
				ast.value[0].ref.start, ast.value[0].ref.end
			);
			return null;
		}
		if (!opperands[1].type.weakMatch(type)) {
			this.getFile().throw(
				`Error: Cannot perform boolean opperation on non-boolean types`,
				ast.value[1].ref.start, ast.value[1].ref.end
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


	compile_expr_clone (ast) {
		let preamble = new LLVM.Fragment();

		let target = this.getVar(ast, false);
		if (target.error) {
			this.getFile().throw( target.msg, target.ref.start, target.ref.end );
			return null;
		}
		preamble.merge(target.preamble);
		target = target.variable;

		let act = target.cloneValue(ast.ref);
		if (act.error) {
			this.getFile().throw( act.msg, act.ref.start, act.ref.end );
			return null;
		}
		preamble.merge(act.preamble);

		return {
			preamble,
			instruction: act.instruction,
			epilog: new LLVM.Fragment(),
			type: act.type
		};
	}

	compile_expr_lend(ast) {
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();

		let target = this.getVar(ast, false);
		if (target.error) {
			this.getFile().throw( target.msg, target.ref.start, target.ref.end );
			return null;
		}
		preamble.merge(target.preamble);
		target = target.variable;

		let act = target.lendValue(ast.ref);
		if (act.error) {
			this.getFile().throw( act.msg, act.ref.start, act.ref.end );
			return null;
		}
		preamble.merge(act.preamble);
		epilog.merge(act.epilog);

		return {
			preamble,
			instruction: act.instruction,
			epilog: epilog,
			type: act.type
		};
	}

	compile_expr_struct (ast) {
		// Check the struct type is correct
		let typeRef = this.getType(ast.value[0]);
		if (!(typeRef instanceof TypeRef)) {
			this.getFile().throw(`Error: Invalid type "${
				Flatten.AccessToString(ast.value[0])
			}"`, ast.ref.start, ast.ref.end);
			return null;
		}
		if (!(typeRef.type instanceof Structure)) {
			this.getFile().throw(`Error: Invalid struct type "${
				Flatten.AccessToString(ast.value[0])
			}"`, ast.ref.start, ast.ref.end);
			return null;
		}
		let type = typeRef.type;


		// Allocate the new structure
		let preamble = new LLVM.Fragment();
		let epilog = new LLVM.Fragment();
		let id = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(id, false, ast.ref),
			new LLVM.Alloc(typeRef.toLLVM(), ast.ref)
		));
		id = id.reference();


		// Create a hit map for uninitialised struct attributes
		let hits = new Array(type.getTermCount()).fill(false);


		for (let x of ast.value[1].value) {

			// Find attribute name
			let name = x.value[0].value;
			let i = type.indexOfTerm(name);
			if (i == -1) {
				this.getFile().throw(
					`Error: Invalid struct attribute name "${name}"`,
				x.value[0].ref.start, x.value[0].ref.end);
				return null;
			}
			if (hits[i]) {
				this.getFile().throw(
					`Error: Attempting to set "${name}" twice in one structure`,
				x.value[0].ref.start, x.value[0].ref.end);
				return null;
			}
			hits[i] = true;


			// Resolve attribute address
			let res = type.accessGEPByIndex(
				i,
				new LLVM.Argument(typeRef.toLLVM(), new LLVM.Name(id, false, x.ref), x.ref),
				x.ref, false
			);
			preamble.merge(res.preamble);
			let reg = res.instruction;

			res = this.compile_expr(x.value[1], null, true);
			if (res == null) {
				return null;
			}
			preamble.merge(res.preamble);
			epilog.merge(res.epilog);
			let instruction = res.instruction;


			// Load the value so it can be written
			if (!res.type.native) {
				let load = new LLVM.ID();
				preamble.append(new LLVM.Set(
					new LLVM.Name(load, false, x.ref),
					new LLVM.Load(
						new LLVM.Type(instruction.type.term, 0),
						instruction.name, x.ref
					)
				));
				instruction = new LLVM.Argument(
					new LLVM.Type(instruction.type.term, 0, x.ref),
					new LLVM.Name(load.reference(), false, x.ref),
				x.ref);
			}


			// Write the value into the new struct
			preamble.append(new LLVM.Store(
				reg,
				instruction,
				x.ref
			));
		}


		// Throw for uninitialised values
		if (hits.includes(false)) {
			hits = hits.map((val, i) => {
				if (val == true) {
					return null;
				}

				return type.terms[i].name;
			}).filter(val => val != null);

			this.getFile().throw(
				`Error: Uninitialised value${hits.length > 1 ? "s" : ""} ` +
					hits.join(", "),
				ast.ref.start, ast.ref.end
			);
		}


		return {
			preamble,
			instruction: new LLVM.Argument(
				typeRef.toLLVM(ast.ref),
				new LLVM.Name(id, false, ast.ref)
			),
			epilog,
			type: typeRef
		};
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
			case "access":
				res = this.compile_loadVariable(ast);
				break;
			case "expr_arithmetic":
				res = this.compile_expr_arithmetic(ast.value[0]);
				break;
			case "expr_compare":
				res = this.compile_expr_compare(ast.value[0]);
				break;
			case "expr_bool":
				res = this.compile_expr_bool(ast.value[0]);
				break;
			case "expr_clone":
				res = this.compile_expr_clone(ast.value[0]);
				break;
			case "expr_lend":
				res = this.compile_expr_lend(ast.value[0]);
				break;
			case "expr_struct":
				res = this.compile_expr_struct(ast);
				break;
			default:
				throw new Error(`Unexpected expression type ${ast.type} at ${ast.ref.toString()}`);
		}

		if (res === null) {
			return null;
		}

		if (res.error) {
			this.getFile().throw( res.msg, res.ref.start, res.ref.end );
			return null;
		}

		if (expects instanceof TypeRef && !expects.matchApprox(res.type)) {
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
			let irType = res.type.toLLVM();


			let id = new LLVM.ID(ast.ref.start);

			res.preamble.append(new LLVM.Set(
				new LLVM.Name(id, false, ast.ref.start),
				inner,
				ast.ref.start
			));
			res.instruction = new LLVM.Argument(
				irType,
				new LLVM.Name(id.reference()),
				ast.ref.start
			);
		}

		res.ref = ast.ref;
		return res;
	}

}


module.exports = ExecutionExpr;