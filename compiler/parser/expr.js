const BNF = require('bnf-parser');
const BNF_SytaxNode = BNF.types.BNF_SyntaxNode;

let precedence = [
	[ "||" ],
	[ "&&" ],
	[ "==", "!=" ],
	[ ">=", "<=", ">", "<" ],
	[ "+", "-" ],
	[ "*", "/", "%" ],
	[ "!", "$", "@" ]
];

for (let [i, collection] of precedence.entries()) {
	for (let item of collection) {
		precedence[item] = i;
	}
}

function GetPrecedence (node) {
	if (typeof(node.tokens) == "string") {
		return precedence[node.tokens] || -1;
	}

	return -1;
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
				[lhs, rhs],
				0,
				opperation.ref.start,
				opperation.ref.end
			)
		],
		0,
		lhs.ref.start,
		rhs.ref.end
	);

	return node;
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