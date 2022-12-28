const { SyntaxNode, ReferenceRange } = require('bnf-parser');



let precedence = {
	expr_arithmetic: 0,
	expr_compare: 2,
	expr_bool: 4,

	expr_invert: 0,
	expr_lend: 0,
	expr_share: 0,
	expr_mul : 1,
	expr_div : 1,
	expr_mod : 1,
	expr_add : 2,
	expr_sub : 2,

	expr_lt    : 3,
	expr_lt_eq : 3,
	expr_gt    : 3,
	expr_gt_eq : 3,
	expr_eq    : 4,

	expr_and : 5,
	expr_or  : 6,

	expr_comma: 7,

	expr_brackets: 8
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
		let A = precedence[a.value[0].type];
		let B = precedence[b.value[0].type];

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


const OPERATION_DICT = {
	// expr_arithmetic
	"+": {
		base: "expr_arithmetic",
		sub: "expr_add"
	},
	"-": {
		base: "expr_arithmetic",
		sub: "expr_sub"
	},
	"*": {
		base: "expr_arithmetic",
		sub: "expr_mul"
	},
	"/": {
		base: "expr_arithmetic",
		sub: "expr_div"
	},
	"%": {
		base: "expr_arithmetic",
		sub: "expr_mod"
	},

	// expr_compare
	"==": {
		base: "expr_compare",
		sub: "expr_eq",
	},
	"!=": {
		base: "expr_compare",
		sub: "expr_neq"
	},
	"<": {
		base: "expr_compare",
		sub: "expr_lt"
	},
	">": {
		base: "expr_compare",
		sub: "expr_gt"
	},
	"<=": {
		base: "expr_compare",
		sub: "expr_lt_eq"
	},
	">=": {
		base: "expr_compare",
		sub: "expr_gt_eq"
	},

	// expr_bool
	"&&": {
		base: "expr_bool",
		sub: "expr_and"
	},
	"||": {
		base: "expr_bool",
		sub: "expr_or"
	}
};

/**
 *
 * @param {SyntaxNode} lhs
 * @param {SyntaxNode} opperation
 * @param {SyntaxNode} rhs
 * @returns {SyntaxNode}
 */
function Construct_Operation(lhs, operation, rhs) {
	let mode = OPERATION_DICT[operation.value];
	if (!mode) {
		throw new Error(`Unexpected expression operation ${operation.value}`);
	}

	let node = new SyntaxNode(
		mode.base,
		[
			new SyntaxNode(
				mode.sub,
				[],
				operation.ref.clone()
			)
		],
		new ReferenceRange(lhs.ref.start.clone(), rhs.ref.end.clone())
	);

	let p = GetPrecedence(lhs, node);

	if (p == 1) {
		node.value[0].value = [
			lhs.value[0].value[1],
			rhs
		];
		lhs.value[0].value[1] = node;

		return lhs;
	} else {
		node.value[0].value = [
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
			case "expr_middle_oper":
				root = Construct_Operation(
					root,
					queue[i],
					queue[i+1]
				);
				i++;
				break;
			case "expr_left_oper":
			default:
				throw new TypeError(`Unexpected expression operator type ${queue[i].type}`);
		}
	}

	return root;
}

module.exports = {
	ApplyPrecedence
};