const BNF = require('bnf-parser');
const fs = require('fs');

const syntax = BNF.types.BNF_Tree.fromJSON(
	JSON.parse(fs.readFileSync(__dirname+"/syntax.json", 'utf8'))
);


function Simplify_Program (node) {
	let out = [];
	for (let inner of node.tokens[1]) {
		out.push(Simplify_Stmt_Top(inner.tokens[0][0]));
	}
	node.tokens = out;

	// Remove irrelevant internal data
	node.reached = null;
	return node;
}

function Simplify_Stmt_Top (node) {
	let inner;
	switch (node.tokens[0].type) {
		case "comment":
			inner = node.tokens[0];
			break;
		case "external":
			inner = Simplify_External(node.tokens[0]);
			break;
		case "function":
			inner = Simplify_Function(node.tokens[0]);
			break;
		case "library":
			inner = Simplify_Library(node.tokens[0]);
			break;
		case "class":
			inner = Simplify_Class(node.tokens[0]);
			break;
		case "template":
			inner = Simplify_Template(node.tokens[0]);
			break;
		case "struct":
			inner = Simplify_Struct(node.tokens[0]);
			break;
		case "flag_definition":
			inner = Simplify_Flag_Definition(node.tokens[0]);
			break;
		default:
			throw new TypeError(`Unexpected top level statement ${node.tokens[0].type}`);
	}

	// Remove irrelevant internal data
	inner.reached = null;
	return inner;
}





function Simplify_Library (node) {
	switch (node.tokens[0].type) {
		case "import":
			node.tokens = [ Simplify_Library_Import(node.tokens[0]) ];
			break;
		case "expose":
			node.tokens = [ Simplify_Library_Expose(node.tokens[0]) ];
			break;
		default:
			throw new TypeError(`Unexpected library statement ${node.tokens[0].type}`);
	}
	node.reached = null;
	return node;
}
function Simplify_Library_Import (node) {
	let out = [null, "*"];
	switch (node.tokens[0].type) {
		case "import_direct":
			out[1] = Simplify_Name(node.tokens[0].tokens[6][0]);
		case "import_as":
			out[0] = Simplify_String(node.tokens[0].tokens[2][0]);
			break;
		default:
			throw new TypeError(`Unexpected library statement ${node.tokens[0].type}`);
	}

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_Library_Expose (node) {
	let match = "";
	if (typeof(node.tokens[2][0].tokens) == "string") {
		match = "*";
	} else {
		match = Simplify_Name(node.tokens[2][0].tokens[0]).tokens;
	}

	node.tokens = match;
	node.reached = null;
	return node;
}



function Simplify_String (node) {
	let data = "";
	for (let seg of node.tokens[0].tokens[1]) {
		if (typeof(seg.tokens) == "string") {
			data += seg.tokens.slice(1);
		} else {
			data += seg.tokens[0].tokens;
		}
	}

	node.tokens = [
		node.tokens[0].tokens[0][0].tokens[0],
		data
	];
	node.reached = null;
	return node;
}



function Simplify_Class (node) {
	// TODO
	return node;
}



function Simplify_Template (node) {
	node.tokens = Simplify_Template_Args(node.tokens[2][0]).tokens;
	node.reached = null;
	return node;
}

function Simplify_Template_Args (node) {
	let out = [ Simplify_Template_Arg(node.tokens[0][0]) ];
	for (let inner of node.tokens[1]) {
		out.push( Simplify_Template_Arg(inner.tokens[3][0]) );
	}

	node.tokens = out;
	node.reached = null;
	return node;
}

function Simplify_Template_Arg (node) {
	switch (node.tokens[0].type) {
		case "data_type":
			return Simplify_Data_Type(node.tokens[0]);
		case "constant":
			return Simplify_Constant(node.tokens[0]);
		default:
			throw new TypeError(`Unexpected data-type type ${node.tokens[0].type}`);
	}
}



function Simplify_Flag_Definition (node) {
	// TODO
	return node;
}



function Simplify_External (node) {
	node.tokens = [
		node.tokens[2][0].tokens,                        // mode
		Simplify_External_Body(node.tokens[6][0]).tokens // internal
	];
	node.reached = null;
	return node;
}
function Simplify_External_Body (node) {
	let out = [];
	for (let inner of node.tokens[0]) {
		let next = Simplify_External_Term(inner.tokens[0][0]);
		if (next) {
			out.push(next);
		}
	}

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_External_Term (node) {
	let inner = null;
	switch (node.tokens[0].type) {
		case "function_outline":
			inner = Simplify_Function_Outline(node.tokens[0]);
			break;
		case "structure":
			inner = Simplify_Struct(node.tokens[0]);
			break;
		case "type_def":
			inner = Simplify_Type_Def(node.tokens[0]);
			break;
		case "declare":
			inner = Simplify_Declare(node.tokens[0]);
			break;
		case "comment":
			break;
		default:
			throw new TypeError(`Unexpected external statement ${node.tokens[0].type}`);
	}

	return inner;
}

function Simplify_Type_Def (node) {
	node.tokens = [
		Simplify_Name(node.tokens[2][0]),   // name
		Simplify_Integer(node.tokens[6][0]) // size
	];
	node.reached = null;
	return node;
}



function Simplify_Struct (node) {
	let out = [
		Simplify_Name(node.tokens[2][0]),
		Simplify_Struct_Body(node.tokens[6][0])
	];
	node.tokens  = out;
	node.reached = null;
	return node;
}
function Simplify_Struct_Body (node) {
	node.tokens = node.tokens[0].map( x => Simplify_Struct_Stmt(x.tokens[1][0]).tokens[0] );
	node.reached = null;
	return node;
}
function Simplify_Struct_Stmt (node) {
	switch (node.tokens[0].type) {
		case "comment":
			break;
		case "struct_attribute":
			node.tokens = [ Simplify_Struct_Attribute(node.tokens[0]) ];
			break;
		default:
			throw new Error(`Unexpected structure statement "${node.tokens[0].type}"`);
	}

	node.reached = null;
	return node;
}
function Simplify_Struct_Attribute (node) {
	let out = [
		Simplify_Data_Type(node.tokens[4][0]),
		Simplify_Name(node.tokens[0][0])
	];

	node.tokens = out;
	node.reached = null;
	return node;
}



function Simplify_Composition (node) {
	node = node.tokens[0];

	if (node.type != "decompose" && node.type != "compose") {
		throw new Error(`Unexpected composition statement "${node.type}"`);
	}

	node.tokens = [ Simplify_Variable(node.tokens[2][0]) ];
	node.reached = null;
	return node;
}



function Simplify_Variable (node) {
	let inner = [
		0,
		Simplify_Name(node.tokens[0][0]),
		node.tokens[1].map(x => {
			return Simplify_Variable_Access(x).tokens;
		})
	];

	node.reached = null;
	node.tokens = inner;
	return node;
}

function Simplify_Variable_Access (node) {
	let out = [];
	switch (node.tokens[0].type) {
		case "accessor_dynamic":
			out = [ "[]", Simplify_Variable_Args(node.tokens[0].tokens[2][0]).tokens ];
			break;
		case "accessor_refer":
			out = [ "->" ];
			break;
		case "accessor_static":
			out = [ ".", Simplify_Name(node.tokens[0].tokens[1][0]) ];
			break;
		default:
			throw new TypeError(`Unexpected accessor type ${node.type}`);
	}

	node.tokens = out;
	node.reached = null;
	return node;
}

function Simplify_Variable_Args (node) {
	let out = [ Simplify_Variable_Arg(node.tokens[0][0]) ];
	for (let inner of node.tokens[1]) {
		out.push( Simplify_Variable_Arg(inner.tokens[3][0]) );
	}

	node.tokens = out;
	node.reached = null;
	return node;
}

function Simplify_Variable_Arg (node) {
	switch (node.tokens[0].type) {
		case "data_type":
			return Simplify_Data_Type(node.tokens[0]);
		case "constant":
			return Simplify_Constant(node.tokens[0]);
		case "variable":
			return Simplify_Variable(node.tokens[0]);
		default:
			throw new TypeError(`Unexpected variable access type ${node.tokens[0].type}`);
	}
}



function Simplify_Name (node) {
	let out = node.tokens[0][0].tokens[0].tokens;
	for (let inner of node.tokens[1]) {
		if (Array.isArray(inner.tokens)) {
			if (inner.tokens[0].type == "letter") {
				out += inner.tokens[0].tokens[0].tokens;
			} else {
				out += inner.tokens[0].tokens;
			}
		} else {
			out += inner.tokens;
		}
	}

	node.tokens  = out;
	node.reached = null;
	return node;
}




function Simplify_Data_Type (node) {
	let inner = [
		0,
		Simplify_Name(node.tokens[0][0]),
		node.tokens[1].map(x => {
			return Simplify_Data_Type_Access(x);
		}),
		node.tokens[2].length > 0 ? Simplify_Template(node.tokens[2][0]) : {   // Template
			type: "template",
			tokens: [],
			ref: {start: null, end:null}
		},
	];

	node.reached = null;
	node.tokens = inner;
	return node;
}

function Simplify_Data_Type_Access (node) {
	node.tokens = [ ".", Simplify_Name(node.tokens[1][0]) ];
	node.reached = null;
	return node;
}





function Simplify_Constant (node) {
	switch (node.tokens[0].type) {
		case "boolean":
			node.tokens = [ Simplify_Boolean(node.tokens[0]) ];
			break;
		case "integer":
			node.tokens = [ Simplify_Integer(node.tokens[0]) ];
			break;
		case "float":
			node.tokens = [ Simplify_Float(node.tokens[0]) ];
			break;
		case "string":
			node.tokens = [ Simplify_String(node.tokens[0]) ];
			break;
		default:
			throw new TypeError(`Unexpected constant expression ${node.tokens[0].type}`);
	}

	node.reached = null;
	return node;
}
function Simplify_Integer(node) {
	node.tokens = ( node.tokens[0].length != 0 ? "-" : "" ) +
		( Simplify_Integer_U( node.tokens[1][0] ).tokens );
	node.reached = null;
	return node;
}
function Simplify_Integer_U (node) {
	if (node.tokens[0].type == "zero") {
		node.tokens = "0";
	} else {
		let out = node.tokens[0].tokens[0][0].tokens;
		for (let val of node.tokens[0].tokens[1]) {
			out += val.tokens;
		};

		node.tokens = out;
	}

	node.reached = null;
	return node;
}
function Simplify_Float (node) {
	let out = Simplify_Integer(node.tokens[0][0]).tokens;  // base
	out += ".";
	out += Simplify_Integer_U(node.tokens[2][0]).tokens;   // remainder

	// Scientific notation
	if (node.tokens[3].length > 0) {
		out += "e";
		out += Simplify_Integer(node.tokens[3][0].tokens[1][0]).tokens;
	}

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_Boolean (node) {
	node.reached = null;
	return node;
}







function Simplify_Function (node) {
	node.tokens = [
		Simplify_Function_Head(node.tokens[0][0]), // head
		Simplify_Function_Body(node.tokens[2][0])  // body
	];
	node.reached = null;
	return node;
}
function Simplify_Function_Outline (node) {
	node.tokens = [
		Simplify_Function_Head(node.tokens[0][0])  // head
	];
	node.reached = null;
	return node;
}
function Simplify_Function_Head (node) {
	node.tokens = [
		node.tokens[6][0] ?                      // Return type
			Simplify_Data_Type  (node.tokens[6][0].tokens[2][0]) :
			null,
		Simplify_Name       (node.tokens[2][0]), // Name
		Simplify_Func_Args  (node.tokens[4][0]), // Arguments
		[]
	];
	node.reached = null;

	// Replace null return type with "void" datatype
	if (node.tokens[0] === null) {
		node.tokens[0] = new BNF.types.BNF_SyntaxNode (
			'data_type',
			[
				0,
				new BNF.types.BNF_SyntaxNode(
					'name',
					'void',
					4,
					new BNF.types.BNF_Reference(0,0,0),
					new BNF.types.BNF_Reference(0,0,0),
					null
				),
				[],
				{ type: 'template', tokens: [], ref: {} }
			],
			[],
			new BNF.types.BNF_Reference(0,0,0),
			new BNF.types.BNF_Reference(0,0,0),
			null
		);
	}

	return node;
}
function Simplify_Function_Body (node) {
	let out = [];
	for (let inner of node.tokens[2]) {
		let res = Simplify_Function_Stmt(inner.tokens[0][0]);
		if (res !== null) {
			out.push( res.tokens[0] );
		}
	}

	node.tokens  = out;
	node.reached = null;
	return node;
}
function Simplify_Function_Stmt (node) {
	let inner;
	switch (node.tokens[0].type) {
		case "comment":
			return null;
		case "declare":
			inner = Simplify_Declare(node.tokens[0]);
			break;
		case "declare_assign":
			inner = Simplify_Declare_Assign(node.tokens[0]);
			break;
		case "assign":
			inner = Simplify_Assign(node.tokens[0]);
			break;
		case "return":
			inner = Simplify_Return(node.tokens[0]);
			break;
		case "call_procedure":
			inner = Simplify_Call(node.tokens[0].tokens[0][0]);
			break;
		case "if":
			inner = Simplify_If(node.tokens[0]);
			break;
		case "while":
			inner = Simplify_While(node.tokens[0]);
			break;
		case "composition":
			inner = Simplify_Composition(node.tokens[0]);
			break;
		case "asm":
		default:
			throw new TypeError(`Unexpected function statement ${node.tokens[0].type}`);
	}

	node.tokens = [inner];
	node.reached = null;
	return node;
}
function Simplify_Func_Args (node) {
	node.tokens = node.tokens[2].length > 0 ? Simplify_Func_Args_List(node.tokens[2][0]).tokens : [];
	node.reached = null;
	return node;
}
function Simplify_Func_Args_List (node) {
	let ittr = node.tokens[0].concat(node.tokens[2].map(x => x.tokens[2][0]));

	node.tokens = ittr.map((arg) => {
		return [
			Simplify_Data_Type(arg.tokens[4][0]), // type
			Simplify_Name(arg.tokens[0][0]),      // name
			arg.tokens[5].length > 0 ? arg.tokens[5].tokens[3][0] : null // default
		]
	});

	node.reached = null;
	return node;
}
function Simplify_Call (node) {
	let out = [
		Simplify_Variable(node.tokens[0][0]),                                  // Call name
		node.tokens[1].length > 0 ? Simplify_Template(node.tokens[1][0]) : {   // Template
			type: "template",
			tokens: []
		},
		node.tokens[5].length > 0 ? Simplify_Call_Args(node.tokens[5][0]) : {  // Arguments
			type: "call_args",
			tokens: []
		},
	];

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_Call_Args (node) {
	node.tokens =
		[ node.tokens[0][0] ].concat(
			node.tokens[1].map(arg => arg.tokens[3][0])
		)
		.map( x => Simplify_Call_Arg(x) );

	node.reached = null;
	return node;
}
function Simplify_Call_Arg(node) {
	if (node.tokens[0].type == "expr_lend") {
		return Simplify_Expr_Lend(node.tokens[0][0]);
	} else {
		return Simplify_Expr(node.tokens[0]);
	}
}



function Simplify_If (node) {
	let out = [
		Simplify_If_Stmt(node.tokens[0][0]),
		node.tokens[1].map(x => Simplify_If_Stmt(x)),
		node.tokens[3].length > 0 ? Simplify_If_Else(node.tokens[3][0]) : null
	];

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_If_Stmt (node) {
	let out = [
		Simplify_Expr(node.tokens[4][0]),
		Simplify_Function_Body(node.tokens[8][0])
	];

	node.tokens  = out;
	node.reached = null;
	return node;
}
function Simplify_If_Else (node) {
	let out = [
		Simplify_Function_Body(node.tokens[2][0])
	];

	node.tokens = out;
	node.reached = null;
	return node;
}



function Simplify_While (node) {
	let out = [
		Simplify_Expr(node.tokens[4][0]),
		Simplify_Function_Body(node.tokens[8][0])
	];

	node.tokens = out;
	node.reached = null;
	return node;
}



function Simplify_Return (node) {
	let inner = [];
	if (node.tokens[1].length == 1) {
		inner = [ Simplify_Expr(node.tokens[1][0].tokens[1][0]) ];
	}

	node.tokens = inner;
	node.reached = null;
	return node;
}



function Simplify_Declare (node) {
	let out = [
		Simplify_Data_Type(node.tokens[6][0]),
		Simplify_Name(node.tokens[2][0])
	];

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_Declare_Assign (node) {
	let out = [
		node.tokens[4][0] ?
			Simplify_Data_Type (node.tokens[4][0].tokens[2][0]) :
			null,
		Simplify_Name (node.tokens[2][0]),
		Simplify_Expr (node.tokens[7][0])
	];

	node.tokens = out;
	node.reached = null;
	return node;
}
function Simplify_Assign  (node) {
	node.tokens = [
		Simplify_Variable (node.tokens[0][0]), // target variable
		Simplify_Expr     (node.tokens[4][0])  // value
	];
	node.reached = null;
	return node;
}



function Simplify_Expr (node) {
	return Simplify_Expr_NoPrecedence (node.tokens[1][0]);
}
function Simplify_Expr_NoPrecedence (node) {
	switch (node.tokens[0].type) {
		case "call":
			return Simplify_Call(node.tokens[0]);
		case "expr_compare":
			return Simplify_Expr_Compare(node.tokens[0]);
		case "expr_arithmetic":
			return Simplify_Expr_Arithmetic(node.tokens[0]);
		case "expr_op":
			return Simplify_Expr_Opperand(node.tokens[0]);
		case "expr_bool":
			return Simplify_Expr_Bool(node.tokens[0]);
		case "expr_clone":
			return Simplify_Expr_Clone(node.tokens[0]);
		default:
			throw new TypeError(`Unexpected arrithmetic expression statement ${node.tokens[0].type}`);
	}
}
function Simplify_Expr_Compare (node) {
	let out = null;

	switch (node.tokens[0].type) {
		case "expr_eq":
		case "expr_neq":
		case "expr_gt":
		case "expr_lt":
		case "expr_gt_eq":
		case "expr_lt_eq":
			out = Simplify_Expr_Binary(node.tokens[0]);
			break;
		default:
			throw new TypeError(`Unexpected arrithmetic expression statement ${node.tokens[0].type}`);
	}

	node.tokens = [out];
	node.reached = null;
	return node;
}
function Simplify_Expr_Arithmetic (node) {
	let out = null;

	switch (node.tokens[0].type) {
		case "expr_mod":
		case "expr_mul":
		case "expr_div":
		case "expr_add":
		case "expr_sub":
			out = Simplify_Expr_Binary(node.tokens[0]);
			break;
		case "expr_invert":
			out = Simplify_Expr_Unary(node.tokens[0]);
			break;
		default:
			throw new TypeError(`Unexpected arrithmetic expression statement ${node.tokens[0].type}`);
	}


	node.tokens = [out];
	node.reached = null;
	return node;
}
function Simplify_Expr_Bool (node) {
	let out = null;

	switch (node.tokens[0].type) {
		case "expr_and":
		case "expr_or":
			out = Simplify_Expr_Binary(node.tokens[0]);
			break;
		case "expr_not":
			out = Simplify_Expr_Unary(node.tokens[0]);
			break;
		default:
			throw new TypeError(`Unexpected arrithmetic expression statement ${node.tokens[0].type}`);
	}

	node.tokens = [out];
	node.reached = null;
	return node;
}
function Simplify_Expr_Unary (node) {
	let out = [
		Simplify_Expr_Opperand(node.tokens[2][0]),
	];

	node.tokens  = out;
	node.reached = null;
	return node;
}
function Simplify_Expr_Binary (node) {
	let out = [
		Simplify_Expr_Opperand(node.tokens[0][0]),
		node.tokens[2][0].tokens,
		Simplify_Expr_Opperand(node.tokens[4][0]),
	];

	node.tokens  = out;
	node.reached = null;
	return node;
}
function Simplify_Expr_Opperand (node) {
	switch (node.tokens[0].type) {
		case "call":
			node = Simplify_Call(node.tokens[0]);
			break;
		case "constant":
			node = Simplify_Constant(node.tokens[0]);
			break;
		case "variable":
			node = Simplify_Variable(node.tokens[0]);
			break;
		default:
			throw new TypeError(`Unexpected expr_p1 statement ${node.tokens[0].type}`);
	}

	node.reached = null;
	return node;
}
function Simplify_Expr_Brackets (node) {
	return Simplify_Expr ( node.tokens[2][0] );
}
function Simplify_Expr_Clone (node) {
	node.tokens = [
		Simplify_Variable(node.tokens[2][0])
	];
	node.reached = null;

	return node;
}
function Simplify_Expr_Lend (node) {
	node.tokens = [
		Simplify_Variable(node.tokens[2][0])
	];
	node.reached = null;

	return node;
}



function Parse (data, filename){
	// Parse the file and check for errors
	let result = BNF.Parse(data+"\n", syntax, "program");

	if (result.hasError || result.isPartial) {
		let ref = result.tree.ref.end;
		let cause = "Unknown";
		if (result.tree.ref.reached) {
			ref = result.tree.ref.reached.getReach();
			cause = result.tree.ref.reached.getCausation();
		}

		let msg = filename ? `${filename}: ` : "";
		msg += `Syntax error at ${ref.toString()}\n`;
		msg += `  ${BNF.Message.HighlightArea(data, ref).split('\n').join('\n  ')}\n\n`;
		msg += `  Interpreted: ${cause}`;
		console.error(msg);
		process.exit(1);
	}

	return Simplify_Program(result.tree);
}

module.exports = Parse;