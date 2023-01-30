const LLVM     = require("../../middle/llvm.js");
const TypeRef  = require('../typeRef.js');

const Flattern = require("../../parser/flatten.js");

const Primative = {
	types: require('../../primative/types.js'),
	Either: require('../../primative/either.js')
};


const ExecutionExpr = require('./expr.js');

class ExecutionFlow extends ExecutionExpr {

	compile_if (ast) {
		let frag = new LLVM.Fragment(ast);

		// Check for elif clause
		// These should have been abstracted during syntax parsing
		if (ast.value[1].length > 0) {
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
			ast.value[0].value[0],
			new TypeRef(Primative.types.bool),
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
		let branch_true = this.compile_branch(ast.value[0].value[1], ast.value[0].ref);
		let branch_false = this.compile_branch(
			ast.value[1].value[0],
			ast.value[1].ref
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


			// Clean up newly defined variables
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
				ast.ref
			);

			if (merger.error) {
				this.getFile().throw(
					merger.msg,
					merger.start, merger.end
				);
				return null;
			}

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
		throw new Error("When statements have been removed and will be replaced with match statements");
	}


	compile_branch (ast, ref, scope = this.scope.clone()) {
		let id = new LLVM.ID(ref);
		let env = this.clone(scope);
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