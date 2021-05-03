const BNF = require('bnf-parser');
const BNF_SytaxNode = BNF.types.BNF_SyntaxNode;



let precedence = {
	expr_arithmetic: 4,
	expr_compare: 2,
	expr_bool: 0,

	expr_mul: 6,
	expr_div: 6,
	expr_mod: 5,
	expr_add: 4,
	expr_sub: 4,

	expr_lt: 3,
	expr_lt_eq: 3,
	expr_gt: 3,
	expr_gt_eq: 3,
	expr_eq: 2,

	expr_and: 1,
	expr_or: 0
};

function GetPrecedence (a, b) {
	let A = precedence[a.type];
	let B = precedence[b.type];
	if (!B) {
		return 1;
	} else if (!A) {
		return -1;
	} else if (A == B) {
		let A = precedence[a.tokens[0].type];
		let B = precedence[b.tokens[0].type];

		if (!B) {
			return 1;
		} else if (!A) {
			return -1;
		} else if (A == B) {
			return 0;
		} else {
			return Math.max(1, Math.min(-1, A-B));
		}
	} else {
		return Math.max(1, Math.min(-1, A-B));
	}
}


/**
 *
 * @param {BNF_SytaxNode} lhs
 * @param {BNF_SytaxNode} opperation
 * @param {BNF_SytaxNode} rhs
 * @returns {BNF_SytaxNode}
 */
function Construct_Operation(lhs, opperation, rhs) {
	let base;
	let sub;
	switch (opperation.tokens) {
		// expr_arithmetic
		case "+":
			base = "expr_arithmetic";
			sub = "expr_add";
			break;
		case "-":
			base = "expr_arithmetic";
			sub = "expr_sub";
			break;
		case "*":
			base = "expr_arithmetic";
			sub = "expr_mul";
			break;
		case "/":
			base = "expr_arithmetic";
			sub = "expr_div";
			break;
		case "%":
			base = "expr_arithmetic";
			sub = "expr_mod";
			break;

		// expr_compare
		case "==":
			base = "expr_compare";
			sub = "expr_eq";
			break;
		case "!=":
			base = "expr_compare";
			sub = "expr_neq";
			break;
		case "<":
			base = "expr_compare";
			sub = "expr_lt";
			break;
		case ">":
			base = "expr_compare";
			sub = "expr_gt";
			break;
		case "<=":
			base = "expr_compare";
			sub = "expr_lt_eq";
			break;
		case ">=":
			base = "expr_compare";
			sub = "expr_gt_eq";
			break;

		// expr_bool
		case "&&":
			base = "expr_bool";
			sub = "expr_and";
			break;
		case "||":
			base = "expr_bool";
			sub = "expr_or";
			break;

		default:
			throw new Error(`Unexpected expression opperation ${opperation.tokens}`);
	}

	let node = new BNF_SytaxNode(
		base,
		[
			new BNF_SytaxNode(
				sub,
				[],
				0,
				opperation.ref.start,
				opperation.ref.end
			)
		],
		0,
		lhs.ref.start,
		rhs.ref.end
	);

	if (GetPrecedence(lhs, node) == 1) {
		node.tokens[0].tokens = [
			lhs.tokens[0].tokens[1],
			rhs
		];
		lhs.tokens[0].tokens[1] = node;

		return lhs;
	} else {
		node.tokens[0].tokens = [
			lhs, rhs
		];

		return node;
	}
}




/**
 *
 * @param {BNF_SytaxNode[]} queue
 * @returns {BNF_SyntaxNode}
 */
function ApplyPrecedence (queue) {
	let root = queue[0];
	for (let i=1; i<queue.length; i++) {
		switch (queue[i].type) {
			case "expr_middle_opper":
				root = Construct_Operation(
					root,
					queue[i],
					queue[i+1]
				);
				i++;
				break;
			case "expr_right_opper":
			default:
				throw new TypeError(`Unexpected expression opperator type ${queue[i].type}`);
		}
	}

	return root;
}

module.exports = {
	ApplyPrecedence
};