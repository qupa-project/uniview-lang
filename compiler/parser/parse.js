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
	node.tokens = node.value[0].value
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
// Out of Date
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
	token.value = [
		Simplify_Name(node.value[0]),
		node.tokens[1].value[0] ?
			Simplify_Trait_Reliance(node.value[1].value[0]) :
			new SyntaxNode('trait_reliance', [], node.value[1].ref.clone()),
		Simplify_Trait_Body(node.value[2])
	];
	return node;
}
function Simplify_Trait_Reliance (node) {
	node.value = [
		node.value[0],
		...node.value[1].map(x => x.value[0])
	].map(Simplify_Data_Type);

	return node;
}
function Simplify_Trait_Body (node) {
	node.value = node.value[0]
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
			throw new Error(`Unexpected class statement "${node.tokens[0].type}"`);
	}
}


function Simplify_Template (node) {
	node.value = Simplify_Template_Args(node.value[0]).value;
	return node;
}
function Simplify_Template_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].map(x => x.value[0])
	].map(Simplify_Template_Arg);

	return node;
}
function Simplify_Template_Arg (node) {
	switch (node.value[0].type) {
		case "data_type":
			return Simplify_Data_Type(node.value[0]);
		case "constant":
			return Simplify_Constant(node.value[0]);
		default:
			throw new TypeError(`Unexpected data-type type ${node.value[0].type}`);
	}
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



function Simplify_Include (node) {
	node.value = [
		// Mode
		node.value[0],

		// Path
		Simplify_String(node.value[1])
	];
	return node;
}



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
			throw new Error(`Unexpected structure statement "${node.tokens[0].type}"`);
	}
}
function Simplify_Struct_Attribute (node) {
	node.value = [
		Simplify_Data_Type(node.value[1]),
		Simplify_Name(node.value[0])
	];

	return node;
}



function Simplify_Variable (node) {
	node.value = [
		// Name
		Simplify_Name(node.value[0]),

		// Accessors
		node.value[1]
			.map(x => Simplify_Variable_Access(x.value[0]))
	];

	return node;
}
function Simplify_Variable_Access (node) {
	switch (node.value[0].type) {
		case "accessor_dynamic":
			node.value = [ Simplify_Variable_Args(node.value[0]) ];
			break;
		case "accessor_static":
			node.value = [ Simplify_Name(node.value[0]) ];
			break;
		default:
			throw new TypeError(`Unexpected accessor type ${node.type}`);
	}

	return node;
}
function Simplify_Variable_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].map(x => x.value[0])
	].map(Simplify_Variable_Arg);

	return node;
}
function Simplify_Variable_Arg (node) {
	switch (node.value[0].type) {
		case "data_type":
			return Simplify_Data_Type(node.value[0]);
		case "constant":
			return Simplify_Constant(node.value[0]);
		case "variable":
			return Simplify_Variable(node.value[0]);
		default:
			throw new TypeError(`Unexpected variable access type ${node.value[0].type}`);
	}
}


function Simplify_Name (node) {
	node.value = node.flat();
	return node;
}



function Simplify_Data_Type (node) {
	node.value = [
		Simplify_Name(node.value[0]),
		node.value[1].value.map(x => {
			return Simplify_Data_Type_Access(x);
		}),
		node.value[2].value.length > 0 ?
			Simplify_Template(node.value[2].value[1]) :
			new SyntaxNode('template', [], new ReferenceRange(new Reference(), new Reference())),
	];
	return node;
}
function Simplify_Data_Type_Access (node) {
	node.value = [ Simplify_Name(node.value[1]) ];
	return node;
}




function Simplify_Constant (node) {
	switch (node.value[0].type) {
		case "boolean":
			node.value = [ Simplify_Boolean(node.value[0]) ];
			break;
		case "void":
			node.value = [ Simplify_Void(node.value[0]) ];
			break;
		case "integer":
			node.value = [ Simplify_Integer(node.value[0]) ];
			break;
		case "float":
			node.value = [ Simplify_Float(node.value[0]) ];
			break;
		case "string":
			node.value = [ Simplify_String(node.value[0]) ];
			break;
		default:
			throw new TypeError(`Unexpected constant expression ${node.value[0].type}`);
	}

	return node;
}
function Simplify_Integer(node) {
	node.value = node.flat();
	return node;
}
function Simplify_Float (node) {
	node.value = node.flat();
	return node;
}
function Simplify_Boolean (node) {
	node.value = node.flat();
	return node;
}
function Simplify_Void (node) {
	node.value = node.flat();
	return node;
}






function Simplify_Function (node) {
	node.value = [
		Simplify_Function_Head(node.value[0]),  // head
		node.value[1].value == ";" ? null :
			Simplify_Function_Body(node.value[1]) // body
	];
	return node;
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
function Simplify_Function_Head (node) {
	let emptyReturn = node.value[2].value.length == 0;

	node.value = [
		!emptyReturn ?                      // Return type
			Simplify_Data_Type  (node.value[2].value[0].value[0]) :
			new SyntaxNode("data_type", [
				new SyntaxNode('name',
					'void',
					new ReferenceRange(new Reference(), new Reference())
				)
			], new ReferenceRange(new Reference(), new Reference())),
		Simplify_Name       (node.value[0]), // Name
		Simplify_Func_Args  (node.value[1]), // Arguments
		[]
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
		node.value = [ func(node.value[0]) ];
		return node;
	} else {
		throw new TypeError(`Unexpected function statement ${node.value[0].type}`);
	}
}
function Simplify_Func_Args (node) {
	node.value = node.value[0].value.length == 0 ? [] :
		[
			node.value[0].value[0].value[0],
			...node.value[0].value[0].value[1].value.map(x => x.value[0])
		].map(Simplify_Argument);

	return node;
}
function Simplify_Argument (node) {
	node.value = [
		node.value[1],
		Simplify_Data_Type(node.value[2]),
		Simplify_Name(node.value[0])
	];

	// Flatten the lend status to a single string
	node.value[0].value = node.value[0].flat();

	return node;
}

function Simplify_Call (node) {
	node.value = [
		// Function Name
		Simplify_Variable(node.value[0]),

		// Template
		node.value[1].value[0] ?
			Simplify_Template(node.value[1].value[0]) :
			new SyntaxNode("template", [], node.ref.clone()),

		// Args
		Simplify_Call_Args(node.value[3])
	];
	return node;
}
function Simplify_Call_Args (node) {
	node.value = [
		...node.value[0].map(x => [
			x.value[0],
			x.value[1].map(x => x.value[0])
		])
	].map(x => Simplify_Call_Arg(x));

	return node;
}
function Simplify_Call_Arg(node) {
	if (node.type == "expr_lend") {
		return Simplify_Expr_Lend(node.value[0]);
	} else {
		return Simplify_Expr(node.value[0]);
	}
}
function Simplify_Call_Procedure(node) {
	return Simplify_Call(node.value[0]);
}


function Simplify_If (node) {
	let head = Simplify_If_Stmt(node.value[0]);
	let elif = node.value[1].map(x => Simplify_If_Stmt(x.value[0]));
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


function Simplify_Return (node) {
	node.value = node.value[0].value.map(x => Simplify_Expr(x.value[0]));
	return node;
}


function Simplify_Declare (node) {
	node.value = [
		// Data Type (if present)
		node.value[1].value.length == 1 ?
			Simplify_Data_Type(node.value[1].value[0].value[0]) :
			new SyntaxNode("blank", "", node.ref.clone()),

		// Name
		Simplify_Name(node.value[0]),

		// Value (if present)
		node.value[2].value.length == 1 ?
			Simplify_Expr(node.value[2].value[0].value[0]) :
			new SyntaxNode("blank", "", node.ref.clone())
	];
	return node;
}
function Simplify_Assign  (node) {
	node.value = [
		Simplify_Variable (node.value[0]), // target variable
		Simplify_Expr     (node.value[2])  // value
	];
	return node;
}


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
	switch (node.value[0].type) {
		case "expr_val":
			return Simplify_Expr_Val(node.value[0]);
		case "expr_brackets":
			return Simplify_Expr_Brackets(node.value[0]);
		case "expr_struct":
			return Simplify_Expr_Struct(node.value[0]);
		default:
			throw new Error(`Unexpected expression argument ${node.value[0].type}`);
	}
}
function Simplify_Expr_Val (node) {
	let subject = node.value[1];
	let isNameSpace = false;
	switch (subject.type) {
		case "variable":
			isNameSpace = true;
			subject = Simplify_Variable(subject);
			break;
		case "constant":
			subject = Simplify_Constant(subject);
			break;
		default:
			throw "Implementation error";
	}

	if (node.value[2].value.length > 0) {
		if (!isNameSpace) {
			console.error(`Error: Malformed function call at ${subject.ref.toString()}`);
			process.exit(1);
		}
		subject = Simplify_Expr_Call(subject, node.value[2].value[0], node.ref);
	}

	let unary = node.value[0].value[0];
	if (unary) {
		subject = Simplify_Expr_Unary(unary, subject);
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
function Simplify_Expr_Call (name, node, ref) {
	return new SyntaxNode(
		"call",
		[
			name,                                     // name
			node.value[0].length > 0 ?                // template
				Simplify_Template(node.value[0].value[0]) :
				new BNF_SyntaxNode(
					"template", [],
					node.ref.clone()
				),
			Simplify_Call_Args(node.value[2])         // args
		],
		ref.clone()
	);
}
function Simplify_Expr_Brackets (node) {
	node.value = [
		Simplify_Expr(node.value[0])
	];
	return node;
}
function Simplify_Expr_Lend (node) {
	node.value = [
		Simplify_Variable(node.value[0])
	];
	return node;
}

function Simplify_Expr_Struct (node) {
	node.value = [
		Simplify_Data_Type(node.value[0]),
		node.value[1].value[0] ?
			Simplify_Expr_Struct_Args(node.value[1].value[0]) :
			null
	];

	return node;
}
function Simplify_Expr_Struct_Args (node) {
	node.value = [
		node.value[0],
		...node.value[1].map(x => x.value[0])
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

	console.log("SIMPLIFY");
	let simp = Simplify_Program(res);

	console.log("DONE");
	process.exit(1);

	return simp;
}