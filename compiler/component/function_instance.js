const { Generator_ID } = require('./generate.js');

const Flatten = require('./../parser/flatten.js');
const LLVM = require('../middle/llvm.js');
const Execution = require('./execution/index.js');
const Scope = require('./memory/scope.js');
const TypeRef = require('./typeRef.js');

const Primitive = {
	types: require('./../primative/types.js')
};

let funcIDGen = new Generator_ID();

class Function_Instance {
	constructor (ctx, ast, external = false, abstract = false) {
		this.ctx = ctx;
		this.ast = ast;
		this.ref = ast.ref.start;
		this.external = external;
		this.abstract = abstract || ast.type == "function_outline";

		this.returnType = null;
		this.signature = [];
		this.calls = new Map();
		this.isInline = false;

		this.linked = false;

		this.id = funcIDGen.next();

		this.constNum = 0;

		this.consts = [];

		this.name = ast.value[0].value[1].value;
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

	getType(access, stack = []) {
		this.ctx.getType(access, stack);
	}

	getFunctionGroup () {
		return this.ctx.getFunctionGroup();
	}
	getFunctionInstance () {
		return this;
	}

	getType(access, stack) {
		return this.ctx.getType(access, stack);
	}

	bindConst(val, ref = null) {
		let id = this.consts.indexOf(val);
		if (id == -1) {
			id = this.consts.length;
			this.consts.push(val);
		}

		return new LLVM.Name(`${this.represent}.const.${id}`, true);
	}


	relink () {
		this.linked = false;
		this.link();
	}

	link () {
		if (this.linked) {
			return;
		}

		let file = this.getFile();

		let head = this.ast.value[0];
		this.signature = [ head.value[0], ...head.value[2].value.map(x => x.value[0]) ]
			.map(x => {
				if (x.type == "blank") {
					return new TypeRef(Primitive.types.void, false, false, false);
				}

				let search = this.getType(x);
				if (search instanceof TypeRef) {
					if (search.type == Primitive.types.void) {
						file.throw(
							`Functions cannot include void type as argument`,
							x.ref.start, x.ref.end
						);
					}
				} else {
					file.throw(
						`Invalid type name "${Flatten.AccessToString(x)}"`,
						x.ref.start, x.ref.end
					);
				}

				// Return the search even if it's invalid
				// That way we check the other args at the same time
				// In case they're also invalid
				return search;
			});

		this.returnType = this.signature.shift();
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

		let head = this.ast.value[0];
		let args = this.signature.map((x, i) => {
			return {
				type: x,
				name: head.value[2].value[i].value[1].value,
				ref: head.value[2].value[i].ref
			};
		});

		let res = scope.register_Args( args );
		if (res == null) {
			return null;
		}
		let argsRegs = res.registers;

		let id = new LLVM.ID();
		let complex = !this.returnType.native;
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
				new LLVM.Type("void", 0, head.value[0].ref) :
				this.returnType.toLLVM(head.value[0].ref),
			new LLVM.Name(this.represent, true, head.value[1].ref),
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
			let inner = exec.compile(this.ast.value[1]);
			if (inner === null) {
				return null;
			}
			frag.merge(inner);
		}

		let gen = new Generator_ID(0);
		frag.assign_ID(gen);

		this.ir.append(frag);
	}

	toString() {
		return `${this.name}(${this.signature.map(x => x.toString()).join(", ")}): ${this.returnType.toString()}`;
	}

	toLLVM() {
		this.ir.stmts = [
			...this.consts
				.map((val, i) => new LLVM.Set(
					new LLVM.Name(`${this.represent}.const.${i}`, true),
					new LLVM.Raw(val)
				)),
			...this.ir.stmts
		];

		return this.ir;
	}
}

module.exports = Function_Instance;