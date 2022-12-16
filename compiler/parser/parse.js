const { ApplyPrecedence } = require('./expr.js');

const { CodeSection } = require('../helper/error.js');

const { SyntaxNode, Parser, ParseError, ReferenceRange, Reference } = require('bnf-parser');
const fs = require('fs');

const syntax = new Parser(
	JSON.parse(
		fs.readFileSync(__dirname+"/syntax.json", 'utf8')
	),
	"Uniview.bnf"
);


function Simplify_Program (node) {
	node.value = node.value[0].value
		.map(x => Simplify_Stmt_Top(x.value[0]));

	return node;
}
function Simplify_Stmt_Top (node) {
	let inner;
	switch (node.value[0].type) {
		case "external":
			inner = Simplify_External(node.value[0]);
			break;
		case "include":
			inner = Simplify_Include(node.value[0]);
			break;
		case "function":
			inner = Simplify_Function(node.value[0]);
			break;
		case "library":
			inner = Simplify_Library(node.value[0]);
			break;
		case "struct":
			inner = Simplify_Struct(node.value[0]);
			break;
		case "impl":
			inner = Simplify_Impl(node.value[0]);
			break;
		case "trait":
			inner = Simplify_Trait(node.value[0]);
			break;
		default:
			throw new TypeError(`Unexpected top level statement ${node.value[0].type}`);
	}

	// Remove irrelevant internal data
	inner.reached = null;
	return inner;
}


/*================================
	Constants
================================*/
function Simplify_Constant (node) {
	switch (node.value[0].type) {
		case "hexadecimal":
		case "octal":
		case "boolean":
		case "void":
		case "integer":
		case "float":
			node.value[0].value = node.value[0].flat();
			break;
		case "string":
			node.value[0] = Simplify_String(node.value[0]);
			break;
		default:
			throw new TypeError(`Unexpected constant expression ${node.value[0].type}`);
	}

	return node;
}
function Simplify_String(node) {
	let str = node.value[0];
	let inner = str.value[0];
	let out = "";
	if (!Array.isArray(inner.value)) {
			throw new TypeError("Internal logic failure. Unexpected string");
	}
	for (let charNode of inner.value) {
			if (charNode.type == "literal") {
					out += charNode.value;
			}
			else {
					let esc = charNode.value;
					switch (esc[1].value) {
							case "b":
									out += "\b";
									break;
							case "f":
									out += "\f";
									break;
							case "n":
									out += "\n";
									break;
							case "r":
									out += "\r";
									break;
							case "t":
									out += "\t";
									break;
							case "v":
									out += "\v";
									break;
							default: out += esc[1].value;
					}
			}
	}

	return new SyntaxNode( "string", out, node.ref );
}
function Simplify_Integer(node) {
	node.value = node.flat();
	return node;
}





/*================================
	Accessors
================================*/
function Simplify_Access (node) {
	node.value = [
		// Name
		Simplify_Name(node.value[0]),

		// Access
		new SyntaxNode(
			"(...)*",
			node.value[1].value.map(x => Simplify_Access_Opt(x.value[0])),
			node.value[1].ref
		)
	];

	return node;
}
function Simplify_Access_Opt (node) {
	switch (node.type) {
		case "access_static":
			return Simplify_Access_Static(node);
		case "access_dynamic":
			return Simplify_Access_Dynamic(node);
		case "access_template":
			return Simplify_Access_Template(node);
		default:
			throw new TypeError(`Unexpected accessor type ${node.type}`);
	}
}

function Simplify_Access_Static (node) {
	node.value = node.flat();
	return node;
}

function Simplify_Access_Dynamic (node) {
	node.value = Simplify_Call_Args(node.value[1]).value;
	return node;
}

function Simplify_Access_Template (node) {
	node.value = Simplify_Access_Template_Args(node.value[0]).value;
	return node;
}
function Simplify_Access_Template_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].value
	].map(Simplify_Access_Template_Arg);

	return node;
}
function Simplify_Access_Template_Arg (node) {
	switch (node.value[0].type) {
		case "constant":
			return Simplify_Constant(node.value[0]);
		case "data_type":
			return Simplify_Data_Type(node.value[0]);
		default:
			throw new Error(`Unknown template argument syntax type ${node.type}`);
	}
}





/*================================
	Variables
================================*/
function Simplify_Name (node) {
	node.value = node.flat();
	return node;
}

function Simplify_Variable (node) {
	// Meaningfully identical in terms of AST simplification
	return Simplify_Access(node);
}

function Simplify_Data_Type (node) {
	node.value = [
		// Lending status
		node.value[0],

		// Name
		Simplify_Name(node.value[1]),

		// Access
		new SyntaxNode(
			"(...)*",
			node.value[2].value.map(x => Simplify_Access_Opt(x.value[0])),
			node.value[2].ref
		)
	];

	return node;
}

function Simplify_Declare (node) {
	node.value = [
		// Data Type (if present)
		node.value[1].value[0] ?
			Simplify_Data_Type(node.value[1].value[0].value[0]) :
			new SyntaxNode("blank", "", node.ref.clone()),

		// Name
		Simplify_Name(node.value[0]),

		// Value (if present)
		node.value[2].value[0] ?
			Simplify_Expr(node.value[2].value[0].value[0]) :
			new SyntaxNode("blank", "", node.ref.clone())
	];
	return node;
}
function Simplify_Assign  (node) {
	node.value = [
		Simplify_Variable (node.value[0]), // target variable
		Simplify_Expr     (node.value[1])  // value
	];
	return node;
}





/*================================
  Function
================================*/
function Simplify_Function (node) {
	node.value = [
		Simplify_Function_Head(node.value[0]),  // head
		node.value[1].value == ";" ?
			new SyntaxNode('blank', "", node.ref.clone()) :
			Simplify_Function_Body(node.value[1]) // body
	];
	return node;
}
function Simplify_Function_Head (node) {
	let emptyReturn = node.value[2].value.length == 0;

	node.value = [
		!emptyReturn ?                      // Return type
			Simplify_Data_Type  (node.value[2].value[0].value[0]) :
			new SyntaxNode("blank", "", node.ref.clone()),
		Simplify_Name       (node.value[0]), // Name
		Simplify_Func_Args  (node.value[1]), // Arguments
		[]
	];

	return node;
}
function Simplify_Func_Args (node) {
	node.value = node.value[0].value.length == 0 ? [] :
		[
			node.value[0].value[0].value[0],
			...node.value[0].value[0].value[1].value.map(x => x.value[0])
		].map(Simplify_Func_Arg);

	return node;
}
function Simplify_Func_Arg (node) {
	node.value = [
		Simplify_Data_Type(node.value[1]),
		Simplify_Name(node.value[0])
	];

	return node;
}

function Simplify_Function_Body (node) {
	node.value = node.value[0].value
		.map(x => Simplify_Function_Stmt(x.value[0]));

	return node;
}
function Simplify_Function_Stmt (node) {
	let func = STMT_MAP[node.value[0].type];

	if (func instanceof Function) {
		return func(node.value[0]);
	} else {
		throw new TypeError(`Unexpected function statement ${node.value[0].type}`);
	}
}

function Simplify_Function_Outline (node) {
	node.value = [
		Simplify_Function_Head(node.value[0])  // head
	];
	return node;
}
function Simplify_Function_Redirect (node) {
	node.value = [
		new SyntaxNode(
			'function_head',
			[
				// Return Type
				node.value[2].value[0] ?
					Simplify_Data_Type(node.value[2].value[0].value[0]) :
					new SyntaxNode('data_type',
						[
							new SyntaxNode(
								"name", "void",
								node.ref.clone()
							),
							[],
							new SyntaxNode(
								'template', [],
								node.ref.clone()
							)
						],
						node.ref.clone()
					),

				// Name
				Simplify_Name(node.value[4]),

				// Arguments
				Simplify_Argument(node.value[1])
			]
		)
	];

	return node;
}

function Simplify_Call (node) {
	node.value = [
		// Function Name
		Simplify_Access(node.value[0]),

		// Args
		Simplify_Call_Body(node.value[1])
	];
	return node;
}
function Simplify_Call_Body (node) {
	return node.value[0].value[0] ?
			Simplify_Call_Args(node.value[0].value[0]) :
			new SyntaxNode('call_args', [], node.ref.clone());
}
function Simplify_Call_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].value.map(x => x.value[0])
	].map(Simplify_Expr);

	return node;
}

function Simplify_Call_Procedure(node) {
	return Simplify_Call(node.value[0]);
}

function Simplify_Return (node) {
	node.value = node.value[0].value.map(x => Simplify_Expr(x.value[0]));
	return node;
}





/*================================
	Structures
================================*/
function Simplify_Struct (node) {
	node.value = [
		Simplify_Name(node.value[0]),
		Simplify_Struct_Body(node.value[1])
	];
	return node;
}
function Simplify_Struct_Body (node) {
	node.value = node.value[0]
		.map( x => Simplify_Struct_Stmt(x.value[0]) );
	return node;
}
function Simplify_Struct_Stmt (node) {
	switch (node.value[0].type) {
		case "struct_attribute":
			return Simplify_Struct_Attribute(node.value[0]);
		default:
			throw new Error(`Unexpected structure statement "${node.value[0].type}"`);
	}
}
function Simplify_Struct_Attribute (node) {
	node.value = [
		Simplify_Data_Type(node.value[1]),
		Simplify_Name(node.value[0])
	];

	return node;
}

function Simplify_Impl (node) {
	let out = [
		Simplify_Data_Type(node.value[0]),
		node.value[1].value[0] ?
			Simplify_Impl_For(node.value[1].value[0]) :
			null,
		Simplify_Impl_Body(node.value[2])
	];

	// Swap the type references when a for is present
	if (out[1]) {
		let t = out[1];
		out[1] = out[0];
		out[0] = t;
	}

	node.value = out;
	return node;
}
function Simplify_Impl_For (node) {
	return Simplify_Data_Type(node.value[0]);
}
function Simplify_Impl_Body (node) {
	node.value = node.value[0]
		.map( x => Simplify_Impl_Stmt(x.value[0]) );
	return node;
}
function Simplify_Impl_Stmt (node) {
	switch (node.value[0].type) {
		case "struct_attribute":
			return Simplify_Struct_Attribute(node.value[0]);
		case "function":
			return Simplify_Function(node.value[0]);
		default:
			throw new Error(`Unexpected class statement "${node.value[0].type}"`);
	}
}

function Simplify_Trait (node) {
	node.value = [
		Simplify_Name(node.value[0]),
		node.value[1].value[0] ?
			Simplify_Trait_Reliance(node.value[1].value[0]) :
			new SyntaxNode('trait_reliance', [], node.value[1].ref.clone()),
		Simplify_Trait_Body(node.value[2])
	];
	return node;
}
function Simplify_Trait_Reliance (node) {
	node.value = [
		node.value[0],
		...node.value[1].value.map(x => x.value[0])
	].map(Simplify_Data_Type);

	return node;
}
function Simplify_Trait_Body (node) {
	node.value = node.value[0].value
		.map( x => Simplify_Trait_Stmt(x.value[0]) );
	return node;
}
function Simplify_Trait_Stmt (node) {
	switch (node.value[0].type) {
		case "struct_attribute":
			return Simplify_Struct_Attribute(node.value[0]);
		case "function":
			return Simplify_Function(node.value[0]);
		default:
			throw new Error(`Unexpected class statement "${node.value[0].type}"`);
	}
}

function Simplify_Expr_Struct (node) {
	node.value = [
		Simplify_Data_Type(node.value[0]),
		Simplify_Expr_Struct_Body(node.value[1])
	];

	return node;
}
function Simplify_Expr_Struct_Body(node) {
	return node.value[0].value[1] ?
		Simplify_Expr_Struct_Args(node.value[0].value[1]) :
		new SyntaxNode('expr_struct_args', [], node.ref);
}
function Simplify_Expr_Struct_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].value.map(x => x.value[0])
	].map(Simplify_Expr_Struct_Arg);

	return node;
}
function Simplify_Expr_Struct_Arg(node) {
	node.value = [
		Simplify_Name(node.value[0]),
		Simplify_Expr(node.value[1])
	];
	return node;
}





/*================================
	Templates
================================*/
function Simplify_Template (node) {
	node.value = Simplify_Template_Args(node.value[0]).value;
	return node;
}
function Simplify_Template_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].value.map(x => x.value[0])
	].map(Simplify_Struct_Attribute);

	return node;
}





/*================================
	Expression
================================*/
function Simplify_Expr (node) {
	let queue = [
		Simplify_Expr_Arg(node.value[0])
	];
	for (let next of node.value[1].value) {
		queue.push(next.value[0]);
		queue.push(Simplify_Expr_Arg(next.value[1]));
	}

	return ApplyPrecedence(queue);
}

function Simplify_Expr_Arg (node) {
	let subject = node.value[1];
	switch (subject.type) {
		case "expr_val":
			subject = Simplify_Expr_Val(subject);
			break;
		case "constant":
			subject = Simplify_Constant(subject);
			break;
		case "expr_brackets":
			return Simplify_Expr_Brackets(subject);
		default:
			throw "Implementation error";
	}

	let unary = node.value[0].value[0];
	if (unary) {
		return Simplify_Expr_Unary(unary, subject);
	}

	return subject;
}
function Simplify_Expr_Unary (operation, node) {
	let operator = operation.flat();

	let innerRef = operation.ref.clone();
	let outerRef = operation.ref.clone();
	outerRef.span(node.ref);

	switch (operator) {
		case "-":
			return new SyntaxNode(
				"expr_arithmetic",
				[
					new SyntaxNode(
						"expr_invert",
						[
							node
						],
					innerRef)
				],
			outerRef);
		case "!":
			return new SyntaxNode(
				"expr_bool",
				[
					new SyntaxNode(
						"expr_not",
						[
							node
						],
						innerRef)
				],
			outerRef);
		case "$":
			return new SyntaxNode(
				"expr_lend",
				[
					node
				],
			outerRef);
		case "@":
			return new SyntaxNode(
				"expr_loan",
				[
					node
				],
			outerRef);
		default:
			throw new Error(`Unexpected unary operation "${operator}"`);
	}
}

function Simplify_Expr_Val (node) {
	let base = Simplify_Access(node.value[0]);

	let extra = node.value[1].value[0];
	if (!extra) {
		return base;
	}

	switch (extra.type) {
		case "expr_struct_body":
			return new SyntaxNode(
				"expr_struct",
				[
					base,
					Simplify_Expr_Struct_Body(extra)
				],
				node.ref
			);
		case "call_body":
			return new SyntaxNode(
				"call",
				[
					base,
					Simplify_Call_Body(extra)
				],
				node.ref
			);
		default:
			throw new Error(`Unknown expr value syntax type ${extra.type}`);
	}
}

function Simplify_Expr_Brackets (node) {
	node.value = [
		Simplify_Expr(node.value[0])
	];
	return node;
}





/*================================
	Library Management
================================*/
function Simplify_Library (node) {
	switch (node.value[0].type) {
		case "import":
			node.value = [ Simplify_Library_Import(node.value[0]) ];
			break;
		default:
			throw new TypeError(`Unexpected library statement ${node.value[0].type}`);
	}
	return node;
}
function Simplify_Library_Import (node) {
	node.value = [
		node.value[1].flat(),
		Simplify_String(node.value[0])
	];
	return node;
}





/*================================
	External
===============================*/
function Simplify_Include (node) {
	node.value = [
		// Mode
		node.value[0],

		// Path
		Simplify_String(node.value[1])
	];
	return node;
}

function Simplify_External (node) {
	node.value = [
		// Mode
		node.value[0],

		// Body
		Simplify_External_Body(node.value[1])
	];
	return node;
}
function Simplify_External_Body (node) {
	node.value = node.value[1]
		.map(x => Simplify_External_Term(x.value[0]));
}
function Simplify_External_Term (node) {
	switch (node.value[0].type) {
		case "function_outline":
			return Simplify_Function_Outline(node.value[0]);
		case "function_redirect":
			return Simplify_Function_Redirect(node.value[0]);
		case "struct":
			return Simplify_Struct(node.value[0]);
		case "type_def":
			return Simplify_Type_Def(node.value[0]);
		case "declare":
			return Simplify_Declare(node.value[0]);
		default:
			throw new TypeError(`Unexpected external statement ${node.value[0].type}`);
	}
}

function Simplify_Type_Def (node) {
	node.value = [
		// Name
		Simplify_Name(node.value[0]),

		// Size
		Simplify_Integer(node.value[1]) // size
	];
	return node;
}





/*================================
	If Statement
================================*/
function Simplify_If (node) {
	let head = Simplify_If_Stmt(node.value[0]);
	let elif = node.value[1].value.map(x => Simplify_If_Stmt(x.value[0]));
	let other =
		node.value[2].value[0] ?
			Simplify_If_Else(node.value[2].value[0]) :
			new BNF_SyntaxNode (
				"else_stmt",
				[ new BNF_SyntaxNode ("function_body", [], node.value[2].clone()) ],
				node.value[2].clone()
			);


	// Merge elifs into new else statement
	while (elif.length > 0) {
		let last = elif.shift();
		let ref = new ReferenceRange(last.ref.start.clone(), other.ref.end.clone());

		other = new BNF_SyntaxNode(
			"else_stmt",
			[new BNF_SyntaxNode(
				"function_body",
				[new BNF_SyntaxNode(
					"if",
					[last, other],
					ref.clone(),
				)],
				ref.clone()
			)],
			ref
		);
	}

	node.value = [
		head,
		other
	];
	node.reached = null;
	return node;
}
function Simplify_If_Stmt (node) {
	node.value = [
		Simplify_Expr(node.value[0]),
		Simplify_Function_Body(node.value[2])
	];
	return node;
}
function Simplify_If_Else (node) {
	node.value = [
		Simplify_Function_Body(node.value[0])
	];
	return node;
}





/*================================
	When Statement
================================*/
function Simplify_When (node) {
	node.value = [
		Simplify_Variable(node.value[0]),
		Simplify_When_Opt(node.value[1])
	];

	return node;
}
function Simplify_When_Opt(node) {
	node.value = node.value.map(Simplify_When_Stmt);
	return node;
}
function Simplify_When_Stmt(node) {
	node.value = [
		node.value[0].type == "literal" ?
			node.value[0] :
			Simplify_Data_Type(node.value[0]),
		Simplify_When_Stmt(node.value[1])
	];

	return node;
}



const STMT_MAP = {
	"declare": Simplify_Declare,
	"assign": Simplify_Assign,
	"return": Simplify_Return,
	"call_procedure": Simplify_Call_Procedure,
	"if": Simplify_If,
	"when": Simplify_When
};



module.exports = function (data, filename){
	// Parse the file and check for errors
	let res = syntax.parse(data, false, "program");
	if (res instanceof ParseError) {
		let msg = filename ? `${filename}: ` : "";
		msg += `Syntax error at ${res.ref.toString()}\n`;
		msg += `  ${CodeSection(data, res.ref.start, res.ref.end).split('\n').join('\n  ')}\n\n`;
		msg += `  Interpreted: ${res.msg}`;

		console.error(msg);
		process.exit(1);
	}

	return Simplify_Program(res);
}