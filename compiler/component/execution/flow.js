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



			// Synchronise possible states into current
			let merger = this.sync(
				[ branch_true.env, branch_false.env ],
				endpoint_id,
				ast.ref
			);

			// Merge branches
			for (const [i, branch] of [branch_true, branch_false].entries()) {

				// Merge synchronisation preamble for each branch
				branch.frag.append(merger.preambles[i]);

				// If the branch didn't return
				if (!branch.env.returned) {
					// Clean up any local variables
					let res = branch.env.cleanup(branch.ref);
					if (res.error) {
						this.getFile().throw(res.msg, res.ref.start, res.ref.end);
						return null;
					}
					branch.frag.append(res);

					// Jump to endpoint
					branch.frag.append(new LLVM.Branch_Unco(endpoint));
				}

				// Append the body of this branch to the main body
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


	compile_branch (ast, ref) {
		let id = new LLVM.ID(ref);
		let env = this.clone();
		env.entryPoint = id;

		let frag = new LLVM.Fragment();
		if (ast !== null) {
			frag.merge(env.compile(ast));
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