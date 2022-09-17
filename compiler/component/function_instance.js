const { Generator_ID } = require('./generate.js');

const Flattern = require('./../parser/flattern.js');
const LLVM = require('../middle/llvm.js');
const Execution = require('./execution/index.js');
const Scope = require('./memory/scope.js');
const TypeRef = require('./typeRef.js');

const Primative = {
	types: require('./../primative/types.js')
};

let funcIDGen = new Generator_ID();

class Function_Instance {
	constructor (ctx, ast, external = false, abstract = false) {
		this.ctx = ctx;
		this.ast = ast;
		this.ref = ast.ref.start;
		this.external = external;
		this.abstract = abstract || this.ast.tokens[1] == null;

		this.returnType = null;
		this.signature = [];
		this.calls = new Map();
		this.isInline = false;

		this.linked = false;

		this.id = funcIDGen.next();

		this.name = ast.tokens[0].tokens[1].tokens;
		this.represent = external ? `${this.name}` : `${this.ctx.represent}.${this.id.toString(36)}`;


		this.ir = new LLVM.Fragment();
	}

	markExport () {
		this.represent = this.name;
	}

	getFileID () {
		return this.ctx.getFileID();
	}

	getFile () {
		return this.ctx.getFile();
	}

	getFunctionGroup () {
		return this.ctx.getFunctionGroup();
	}
	getFunctionInstance () {
		return this;
	}

	getType(node, template) {
		return this.ctx.getType(node, template);
	}


	relink () {
		this.linked = false;
		this.link();
	}

	link () {
		if (this.linked) {
			return;
		}

		this.signature = [];
		let file = this.getFile();
		let head = this.ast.tokens[0];
		let args = head.tokens[2].tokens;

		// Flaten signature types AST into a single array
		let types = [ head.tokens[0] ];
		let borrows = [ false ];
		let consts = [ false ];
		if (args.length > 0) {
			borrows = borrows.concat(args.map(x => x[0] == "@"));
			consts = consts.concat(args.map(x => x[0] == "&"));
			types = types.concat(args.map((x) => x[1]));
		}

		// Generate an execution instance for type resolving
		let exec = new Execution(
			this,
			null,
			new Scope(this, this.getFile().project.config.caching)
		);

		for (let [i, type] of types.entries()){
			let search = exec.resolveType(type);
			if (search instanceof TypeRef) {
				if (i !== 0 && search.type == Primative.types.void) {
					file.throw(
						`Functions cannot include void type as argument`,
						type.ref.start, type.ref.end
					);
				}

				search.pointer  = type.tokens[0]; // Copy the pointer level across
				search.lent     = borrows[i];
				search.constant = consts[i];

				this.signature.push(search);
			} else {
				file.throw(
					`Invalid type name "${Flattern.DataTypeStr(type)}"`,
					type.ref.start, type.ref.end
				);
			}
		}

		this.returnType = this.signature.splice(0, 1)[0];
		this.linked = true;
	}



	match (other) {
		// Ensure both functions have linked their data types
		this.link();
		other.link();

		// Match the signatures
		return this.matchSignature(other.signature);
	}
	matchSignature (sig) {
		if (this.signature.length != sig.length) {
			return false;
		}

		for (let i=0; i<sig.length; i++) {
			if (!this.signature[i].match(sig[i])) {
				return false;
			}
		}

		return true;
	}



	compile () {
		if (this.abstract && !this.external) {
			return null;
		}

		let scope = new Scope(
			this,
			this.getFile().project.config.caching
		);

		let head = this.ast.tokens[0];
		let args = [];
		for (let i=0; i<this.signature.length; i++) {
			args.push({
				type: this.signature[i],                     // TypeRef
				name: head.tokens[2].tokens[i][2].tokens,    // Name
				ref: head.tokens[2].tokens[i][2].ref.start   // Ref
			});
		}

		let res = scope.register_Args( args );
		if (res == null) {
			return null;
		}
		let argsRegs = res.registers;

		let id = new LLVM.ID();
		let complex = this.returnType.type.typeSystem == "linear";
		if (complex) {
			argsRegs = [
				new LLVM.Argument(
					this.returnType.toLLVM(),
					new LLVM.Name(id, false)
				),
				...argsRegs
			];
		}

		let frag = new LLVM.Procedure(
			complex ?
				new LLVM.Type("void", 0, head.tokens[0].ref) :
				this.returnType.toLLVM(head.tokens[0].ref),
			new LLVM.Name(this.represent, true, head.tokens[1].ref),
			argsRegs,
			"#1",
			this.external,
			this.ref
		);

		if (!this.abstract && !this.external) {
			// Mark the entry point
			let entry_id = new LLVM.ID();
			let entry = new LLVM.Label( entry_id, this.ast.ref.start );
			frag.append( entry.toDefinition(true) );

			// Apply the argument reads
			frag.merge(res.frag);

			// Compile the internal behaviour
			let exec = new Execution(
				this,
				this.returnType,
				scope,
				entry_id.reference()
			);
			let inner = exec.compile(this.ast.tokens[1]);
			if (inner === null) {
				return null;
			}
			frag.merge(inner);
		}

		let gen = new Generator_ID(0);
		frag.assign_ID(gen);

		this.ir = frag;
	}

	toString() {
		return `${this.name}(${this.signature.map(x => x.toString()).join(", ")}): ${this.returnType.toString()}`;
	}

	toLLVM() {
		return this.ir;
	}
}

module.exports = Function_Instance;