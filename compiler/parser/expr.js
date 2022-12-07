const { SyntaxNode } = require('bnf-parser');



let precedence = {
	expr_arithmetic: 0,
	expr_compare: 2,
	expr_bool: 4,

	expr_mul : 0,
	expr_div : 0,
	expr_mod : 0,
	expr_add : 1,
	expr_sub : 1,

	expr_lt    : 2,
	expr_lt_eq : 2,
	expr_gt    : 2,
	expr_gt_eq : 2,
	expr_eq    : 3,

	expr_and : 4,
	expr_or  : 5,

	expr_brackets: 6
};

function GetPrecedence (a, b) {
	if (a.type == "expr_brackets") {
		return 0;
	}

	let A = precedence[a.type];
	let B = precedence[b.type];
	if (A == undefined && B == undefined) {
		return 0;
	} else if (A == B) {
		let A = precedence[a.tokens[0].type];
		let B = precedence[b.tokens[0].type];

		if (A  == undefined && B  == undefined) {
			return 0;
		} else if (B == undefined) {
			return 1;
		} else if (A == undefined) {
			return -1;
		} else {
			return Math.min(1, Math.max(-1, A-B));
		}
	} else if (B == undefined) {
		return 1;
	} else if (A == undefined) {
		return -1;
	} else {
		return Math.min(1, Math.max(-1, A-B));
	}
}


/**
 *
 * @param {SyntaxNode} lhs
 * @param {SyntaxNode} opperation
 * @param {SyntaxNode} rhs
 * @returns {SyntaxNode}
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

	let node = new SyntaxNode(
		base,
		[
			new SyntaxNode(
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

	let p = GetPrecedence(lhs, node);

	if (p == 1) {
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
 * @param {SyntaxNode[]} queue
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