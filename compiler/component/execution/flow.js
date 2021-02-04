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
			return frag;
		}


		/**
		 * Prepare entry point
		 */


		/**
		 * Prepare the condition value
		 */
		let cond = this.compile_expr(
			ast.tokens[0].tokens[0],
			new TypeRef(0, Primative.types.bool),
			true
		);
		if (cond.epilog.stmts.length > 0) {
			throw new Error("Cannot do an if-statement using instruction with epilog");
		}
		frag.merge(cond.preamble);


		/**
		 * Prepare condition true body
		 */
		let true_id = new LLVM.ID(ast.tokens[0].tokens[1].ref);
		let branch_true = this.clone();
		branch_true.entryPoint = true_id;
		let body_true = branch_true.compile(ast.tokens[0].tokens[1]);
		body_true.prepend(new LLVM.Label(
			true_id,
			ast.tokens[0].tokens[1].ref
		).toDefinition());


		/**
		 * Prepare condition false body
		 */
		let hasElse = ast.tokens[2] !== null;
		let false_id = new LLVM.ID();
		let body_false = new LLVM.Fragment();
		let branch_false = this.clone();
		branch_false.entryPoint = false_id;
		if (hasElse) {
			body_false = branch_false.compile(ast.tokens[2].tokens[0]);
			body_false.prepend(new LLVM.Label(
				false_id
			).toDefinition());
		}


		/**
		 * Cleanup and merging
		 */
		let endpoint_id = new LLVM.ID();
		let endpoint = new LLVM.Label(
			new LLVM.Name(endpoint_id.reference(), false)
		);


		// Push the branching jump
		frag.append(new LLVM.Branch(
			cond.instruction,
			new LLVM.Label(
				new LLVM.Name(true_id.reference(), false, ast.tokens[0].tokens[1].ref),
				ast.tokens[0].tokens[1].ref
			),
			new LLVM.Label(
				new LLVM.Name( hasElse ? false_id.reference() : endpoint_id.reference() , false)
			),
			ast.ref.start
		));


		// Push the if branch
		frag.merge(body_true);
		if (!branch_true.returned) {
			frag.append(new LLVM.Branch_Unco(endpoint));
		}

		// Push the else branch
		if (hasElse) {
			frag.merge(body_false);
			if (!branch_false.returned) {
				frag.append(new LLVM.Branch_Unco(endpoint));
			}
		}

		// Both branches returned
		if (branch_true.returned && branch_false.returned) {
			this.returned = true;
		}

		// Push the end point
		if (!this.returned) {
			frag.append(new LLVM.Label(
				endpoint_id
			).toDefinition());
		}


		let tail_segment = hasElse ? false_id : endpoint_id;

		// Synchronise possible states into current
		let merger = this.sync(
			hasElse ? [branch_true, branch_false] :
				[ this, branch_true, branch_false ],
			tail_segment,
			ast.ref
		);
		frag.merge(merger);


		// Mark current branch
		this.entryPoint = tail_segment;
		return frag;
	}

}


module.exports = ExecutionFlow;