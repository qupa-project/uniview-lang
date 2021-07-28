const LLVM     = require("../../middle/llvm.js");
const TypeRef  = require('../typeRef.js');

const Primative = {
	types: require('../../primative/types.js')
};


const ExecutionExpr = require('./expr.js');

class ExecutionFlow extends ExecutionExpr {

	compile_if (ast) {
		let frag = new LLVM.Fragment(ast);

		// Check for elif clause
		if (ast.tokens[1].length > 0) {
			this.getFile().throw(
				`Error: Elif statements are currently unsupported`,
				ast.ref.start, ast.ref.end
			);
			return null;
		}




		/*===================================
			Prepare condition value
		===================================*/
		let cond = this.compile_expr(
			ast.tokens[0].tokens[0],
			new TypeRef(0, Primative.types.bool),
			true
		);
		if (cond == null) {
			return null;
		}
		if (cond.epilog.stmts.length > 0) {
			throw new Error("Cannot do an if-statement using instruction with epilog");
		}
		frag.merge(cond.preamble);





		/*===================================
			Prepare condition bodies
		===================================*/
		let branch_true = this.compile_branch(ast.tokens[0].tokens[1], ast.tokens[0].ref);
		let branch_false = this.compile_branch(
			ast.tokens[1].tokens[0],
			ast.tokens[1].ref
		);

		if (branch_false == null || branch_true == null) {
			return null;
		}




		/*===================================
			Cleanup and merging
		===================================*/

		// Push the branching jump
		frag.append(new LLVM.Branch(
			cond.instruction,
			new LLVM.Label(
				new LLVM.Name(branch_true.id, false),
			),
			new LLVM.Label(
				new LLVM.Name(branch_false.id, false)
			),
			ast.ref.start
		));


		// If both branches have returned,
		//   execution does not continue
		//   thus cleanup is not needed
		if (branch_true.env.returned && branch_false.env.returned) {
			frag.append(branch_true.frag);
			frag.append(branch_false.frag);

			this.returned = true;
		} else {

			// Mark end of the if statement
			let endpoint_id = new LLVM.ID();
			let endpoint = new LLVM.Label(
				new LLVM.Name(endpoint_id.reference(), false)
			);
			this.entryPoint = endpoint_id;

			// Define the branch sets
			let totalSet = [ branch_true, branch_false ];
			let continousSet = totalSet.filter( x => x.env.returned == false );


			// Clean up any local variables
			for (const branch of continousSet) {
				let res = branch.env.cleanup(branch.ref);
				if (res.error) {
					this.getFile().throw(res.msg, res.ref.start, res.ref.end);
					return null;
				}
				branch.frag.append(res);
			}


			// Synchronise possible states into current
			let merger = this.sync(
				continousSet.map( x => x.env ),
				endpoint_id,
				ast.ref
			);

			// Merge branches
			for (const [i, branch] of continousSet.entries()) {

				// Merge synchronisation preamble for each branch
				branch.frag.merge(merger.preambles[i]);

				// Jump to endpoint
				branch.frag.append(new LLVM.Branch_Unco(endpoint));
			}


			// Append the body of branches
			for (const branch of totalSet) {
				frag.merge(branch.frag);
			}


			// Push the end point label
			frag.append(new LLVM.Label(
				endpoint_id
			).toDefinition());


			// Append the synchronisation finalisation
			frag.append(merger.frag);
		}

		return frag;
	}


	compile_when (ast) {
		let frag = new LLVM.Fragment();

		let target = this.compile_loadVariable(ast.tokens[0]);
		if (target.error) {
			this.getFile().throw(target.msg, target.ref.start, target.ref.end);
			return null;
		}
		frag.append(target.preamble);

		let options = target.type.type.signature.map(x => x.type);
		let seen = [];
		let branches = [];
		let spare = null;

		// Process each branch of the when statement
		for (let select of ast.tokens[1]) {
			if (select.tokens[0].type == "data_type") {
				let typeRef = this.resolveType(select.tokens[0]);
				if (!(typeRef instanceof TypeRef)) {
					this.getFile().throw(
						`Error: Invalid type name "${Flattern.DataTypeStr(select.tokens[0])}"`,
						select.ref.start,
						select.ref.end
					);
					return null;
				}

				let index = options.indexOf(typeRef.type);
				if (index === -1) {
					this.getFile().throw(
						`Error: Invalid type "${typeRef.type.name}" as it is not represented within this either`,
						select.ref.start,
						select.ref.end
					);
					return null;
				}
				if (seen.indexOf(index) != -1) {
					this.getFile().throw(
						`Error: Type "${typeRef.type.name}" has already been used within this when statement`,
						select.ref.start,
						select.ref.end
					);
					return null;
				}

				let branch = this.compile_branch(select.tokens[1], select.ref);
				if (branch === null) {
					return null;
				}

				branches.push([
					index,
					branch
				]);
				seen.push(index);

			} else {
				spare = this.compile_branch(select.tokens[1], select.ref);
				if (spare === null) {
					return null;
				}
			}
		}

		// Check if the when statement covers all options
		if (!spare && options.length != seen.length) {
			this.getFile().throw(
				`Error: This when statement does not cover all possible types\n` +
				`        Suggest adding a default case to resolve the issue`,
				ast.ref.start,
				ast.ref.end
			);
			return null;
		}

		// Load the current state of the dynamic type
		let ptr = new LLVM.ID();
		frag.append(new LLVM.Set(
			new LLVM.Name(ptr, false, ast.ref),
			new LLVM.GEP(
				new LLVM.Type(target.type.type.represent, 0),
				target.instruction,
				[
					new LLVM.Argument(
						new LLVM.Type("i32", 0),
						new LLVM.Constant("0")
					),
					new LLVM.Argument(
						new LLVM.Type("i32", 0),
						new LLVM.Constant("1")
					)
				]
			),
			ast.ref
		));
		let state = new LLVM.ID();
		frag.append(new LLVM.Set(
			new LLVM.Name(state, false, ast.ref),
			new LLVM.Load(
				new LLVM.Type("i8", 0),
				new LLVM.Name(ptr.reference(), false, ast.ref)
			),
			ast.ref
		));

		// Construct the targeted jump statement
		let endpoint_id = new LLVM.ID();
		let endLabel = new LLVM.Label(new LLVM.Name(endpoint_id.reference()));
		frag.append(new LLVM.Switch(
			new LLVM.Argument(
				new LLVM.Type("i8", 0),
				new LLVM.Name(state.reference(), false)
			),
			spare ?
				new LLVM.Label(new LLVM.Name(spare.id.reference(), false)) :
				endLabel,
			branches.map(x => [
				new LLVM.Argument(
					new LLVM.Type("i8", 0),
					new LLVM.Constant(x[0].toString())
				),
				new LLVM.Label(new LLVM.Name(x[1].id.reference(), false))
			])
		));




		let totalSet = branches.map(x => x[1]);
		if (spare) {
			totalSet.push(spare);
		}

		let continousSet = totalSet.filter( x => x.env.returned == false );
		let allReturned = continousSet.length == 0;

		if (!allReturned) {
			for (let branch of continousSet) {
				let res = branch.env.cleanup(branch.ref);
				if (res.error) {
					this.getFile().throw(res.msg, res.ref.start, res.ref.end);
					return null;
				}
				branch.frag.append(res);
			}

			let merger = this.sync(
				continousSet.map(x => x.env),
				endpoint_id,
				ast.ref
			);

			// Merge branches
			for (const [i, branch] of continousSet.entries()) {
				// Merge synchronisation preamble for each branch
				branch.frag.merge(merger.preambles[i]);

				// Jump to endpoint
				branch.frag.append(new LLVM.Branch_Unco(endLabel));
			}
		}


		// Append the body of branches
		for (const branch of totalSet) {
			frag.merge(branch.frag);
		}


		frag.append(new LLVM.Label(endpoint_id).toDefinition());

		if (allReturned) {
			frag.append(new LLVM.Raw("unreachable"));
			this.returned = true;
		}


		return frag;
	}


	compile_branch (ast, ref) {
		let id = new LLVM.ID(ref);
		let env = this.clone();
		env.entryPoint = id;

		let frag = new LLVM.Fragment();
		if (ast !== null) {
			let res = env.compile(ast);
			if (res === null) {
				return null;
			}
			frag.merge(res);
		}

		// Add the start label
		frag.prepend(new LLVM.Label(
			id,
			ref
		).toDefinition());

		return {
			id: id.reference(),
			env: env,
			frag: frag,
			ref: ref
		};
	}

}





module.exports = ExecutionFlow;