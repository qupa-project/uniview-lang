const LLVM = require('./../middle/llvm.js');

const Function_Instance = require('./function_instance.js');

const Template = require('../component/template.js');
const TypeRef = require('../component/typeRef.js');
const TypeDef = require('../component/typedef.js');

class Either extends Template {
	constructor (ctx) {
		super(ctx, null);

		this.children = [];
	}

	findMatch (inputType) {
		for (let child of this.children) {
			if (child.match(inputType)) {
				return new TypeRef(0, child, false, false);
			}
		}

		return null;
	}

	getFile() {
		return this.ctx.getFile();
	}

	getFunction (access, signature, template) {
		let child = this.getType([], template);
		if (child) {
			return child.type.getFunction(access, signature, template);
		}

		return false;
	}

	getType (access, template, stack) {
		if (access.length != 0) {
			return;
		}

		// Valid types for either statement
		if (template.map(x =>
			!(x.type.type instanceof TypeDef) ||
			x.lent ||
			x.constant
		).includes(false)) {
			return false;
		}

		let res = this.findMatch(template);
		if (res) {
			return res;
		}

		let child = new Either_Instance(this.ctx, template, this.children.length);
		this.children.push(child);

		return new TypeRef(0, child, false, false);
	}

	toLLVM(ref) {
		let frag = new LLVM.Fragment();
		for (let child of this.children) {
			frag.append(child.toLLVM(ref));
		}

		return frag;
	}
}

class Either_Instance {
	constructor (ctx, signature, id) {
		this.ctx = ctx;
		this.signature = signature;
		this.name = `Either#[${signature.map(x => x.type.name).join(", ")}]`;
		this.represent = `%Either.${id}`;
		this.typeSystem = "linear";
		this.size = -1;

		this.getSize();
	}

	getDestructor() {
		return false;
	}
	getCloner() {
		return false;
	}

	getFile() {
		return this.ctx.getFile();
	}

	getFunction (access, signature, template) {
		if (access.length != 0 || signature.length != 1) {
			return false;
		}

		let found = false;
		let i=0;
		for (; i<this.signature.length && !found; i++) {
			if (this.signature[i].match(signature[0])) {
				found = true;
				break;
			}
		}
		if (!found) {
			return false;
		}

		let func = new Function_Instance(
			this,
			"Either.New",
			new TypeRef(0, this, false, false)
		);

		func.generate = (regs, ir_args) => {
			let frag = new LLVM.Fragment();

			let type = new LLVM.Type(this.represent, 0);
			let val = new LLVM.ID();
			frag.append(new LLVM.Set(
				new LLVM.Name(val, false),
				new LLVM.Alloc(type)
			));

			let state = new LLVM.ID();
			frag.append(new LLVM.Set(
				new LLVM.Name(state),
				new LLVM.GEP(
					type,
					new LLVM.Argument(
						new LLVM.Type(this.represent, 1),
						new LLVM.Name(val.reference(), false)
					),
					[
						new LLVM.Argument(
							new LLVM.Type("i32", 0),
							new LLVM.Constant("0")
						),
						new LLVM.Argument(
							new LLVM.Type("i32", 0),
							new LLVM.Constant("1")
						)
					]
				)
			));
			frag.append(new LLVM.Store(
				new LLVM.Argument(
					new LLVM.Type("i8", 1),
					new LLVM.Name(state.reference())
				),
				new LLVM.Argument(
					new LLVM.Type("i8", 0),
					new LLVM.Constant(i.toString())
				)
			));


			if (ir_args[0].type.term != "void") {
				let data = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(data),
					new LLVM.GEP(
						type,
						new LLVM.Argument(
							new LLVM.Type(this.represent, 1),
							new LLVM.Name(val.reference(), false)
						),
						[
							new LLVM.Argument(
								new LLVM.Type("i32", 0),
								new LLVM.Constant("0")
							),
							new LLVM.Argument(
								new LLVM.Type("i32", 0),
								new LLVM.Constant("0")
							)
						]
					)
				));

				let nx_type = new LLVM.Type(ir_args[0].type.term, 1);
				let store = new LLVM.ID();
				frag.append(new LLVM.Set(
					new LLVM.Name(store, false),
					new LLVM.Bitcast(
						nx_type,
						new LLVM.Argument(
							new LLVM.Type(`<${this.getSize()} x i8>`, 1), // -1
							new LLVM.Name(data.reference())
						)
					)
				));

				frag.append(new LLVM.Store(
					new LLVM.Argument(
						nx_type,
						new LLVM.Name(store.reference())
					),
					ir_args[0]
				));
			}

			return {
				preamble: frag,
				instruction: new LLVM.Argument(
					new LLVM.Type(this.represent, 1),
					new LLVM.Name(val.reference(), false)
				),
				type: new TypeRef(0, this, false, false)
			};
		};
		func.compile();


		return func;
	}

	match (signature) {
		if (this.signature.length != signature.length) {
			return false;
		}

		for (let i=0; i<this.signature.length; i++) {
			if (this.signature[i].match(signature[i]) == false) {
				return false;
			}
		}

		return true;
	}

	getSize() {
		if (this.size != -1) {
			return this.size;
		}

		let max = this.signature[0].type.size;
		for (let i=1; i<this.signature.length; i++) {
			max = Math.max(max, this.signature[i].type.size);
		}

		this.size = max;
		return this.size;
	}

	toLLVM(ref) {
		return new LLVM.Struct(
			new LLVM.Name(this.represent, false, ref),
			[
				new LLVM.Type(`<${this.getSize()} x i8>`, 0), // -1
				new LLVM.Type("i8", 0)
			],
			ref
		);
	}

	sizeof (ref) {
		return {
			preamble: new LLVM.Fragment(),
			instruction: new LLVM.Argument(
				new LLVM.Type("i64"),
				new LLVM.Constant(this.getSize()+1),
				ref
			)
		};
	}
}

Either.Either_Instance = Either_Instance;


module.exports = Either;