const LLVM = require('./../middle/llvm.js');
const TypeDef = require('./typedef.js');
const Flattern = require('../parser/flattern.js');
const TypeRef = require('./typeRef.js');

const Primative = {
	types: require('./../primative/types.js')
};


class Struct_Term {
	constructor(name, typeRef, ref) {
		this.name = name;
		this.typeRef = typeRef;
		this.declared = ref;
		this.size = typeRef.pointer > 0 ? 4 : typeRef.type.size;

		this.typeSystem = "linear";

		this.ir = new LLVM.Fragment();
	}

	toLLVM() {
		return this.typeRef.toLLVM(this.declared);
	}
}


class Structure extends TypeDef {
	constructor (ctx, ast, external = false) {
		super(ctx, ast, external);
		this.terms = [];
		this.linked = false;
	}

	/**
	 *
	 * @param {String} name
	 * @returns {Object}
	 */
	getTerm (name, register, ref) {
		let found = false;
		let i = 0;
		if (typeof(name) == "number") {
			found = i < this.terms.length;
			i = name;
		} else{
			for (; i<this.terms.length && !found; i++) {
				if (this.terms[i].name == name.tokens) {
					found = true;
					break;
				}
			}
		}
		if (!found) {
			return null;
		}

		let res = this.accessGEPByIndex(i, register, ref);

		return {
			preamble: res.preamble,
			instruction: res.instruction,
			index: i,
			type: res.type.duplicate()
		};
	}

	getTermCount () {
		return this.terms.length;
	}

	accessGEPByIndex (i, register, ref) {
		return {
			preamble: new LLVM.Fragment(),
			instruction: new LLVM.GEP(
				register.type.duplicate().offsetPointer(-1, register.declared).toLLVM(),
				register.store,
				[
					new LLVM.Argument(
						Primative.types.i32.toLLVM(),
						new LLVM.Constant("0", ref),
						ref
					),
					new LLVM.Argument(
						new LLVM.Type("i32", 0, ref),
						new LLVM.Constant(i.toString(), ref)
					)
				],
				ref
			),
			type: this.terms[i].typeRef
		}
	}

	parse () {
		this.name = this.ast.tokens[0].tokens;
		this.represent = "%struct." + (
			this.external ? this.name : `${this.name}.${this.ctx.getFileID().toString(36)}`
		);
	}

	link (stack = []) {
		if (stack.indexOf(this) != -1) {
			this.ctx.getFile().throw(
				`Error: Structure ${this.name} contains itself, either directly or indirectly`,
				this.ast.ref.start,
				this.ast.ref.end
			);
			return;
		}
		if (this.linked) {
			return;
		}

		let termNames = [];
		this.linked = true;
		this.size = 0;
		for (let node of this.ast.tokens[1].tokens) {
			let name = node.tokens[1].tokens;
			if (termNames.indexOf(name) != -1) {
				this.ctx.getFile().throw(
					`Error: Multiple use of term ${name} in struct`,
					this.terms[name].declared,
					node.ref.end
				);
				return;
			}

			let typeNode = node.tokens[0];
			let typeRef = this.ctx.getType(Flattern.DataTypeList(typeNode));
			if (typeRef === null) {
				this.ctx.getFile().throw(
					`Error: Unknown type ${Flattern.DataTypeStr(typeNode)}`,
					typeNode.ref.start,
					typeNode.ref.end
				);
				return;
			}
			if (!typeRef.type.linked) {
				type.link([this, ...stack]);
			}
			let term = new Struct_Term(
				name,
				new TypeRef(typeNode.tokens[0], typeRef.type),
				node.ref.start
			);
			this.terms.push(term);
			this.size += term.size;
		}
	}

	compile () {
		let types = [];
		for (let name in this.terms) {
			types.push(this.terms[name].toLLVM());
		}

		this.ir = new LLVM.Struct(
			new LLVM.Name(this.represent, false, this.ref),
			types,
			this.ref
		);
	}

	toLLVM() {
		return this.ir;
	}


	/**
	 *
	 * @param {LLVM.Argument} argument
	 */
	cloneInstance(argument, ref) {
		let preamble = new LLVM.Fragment();

		let type = new TypeRef(1, this);

		let storeID = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(storeID, false),
			new LLVM.Alloc(type.duplicate().offsetPointer(-1).toLLVM())
		));
		let instruction = new LLVM.Argument(
			type.toLLVM(),
			new LLVM.Name(storeID.reference(), false)
		);

		let sizePtrID = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(sizePtrID, false),
			new LLVM.GEP(
				type.duplicate().offsetPointer(-1).toLLVM(),
				new LLVM.Argument(
					type.duplicate().toLLVM(),
					new LLVM.Constant("null")
				),
				[new LLVM.Argument(
					new LLVM.Type("i64", 0),
					new LLVM.Constant("1")
				)]
			)
		));

		let sizeID = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(sizeID, false),
			new LLVM.PtrToInt(
				new LLVM.Type("i64", 0),
				new LLVM.Argument(
					type.duplicate().toLLVM(),
					new LLVM.Name(sizePtrID.reference(), false),
				)
			)
		));

		let fromID = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(fromID, false),
			new LLVM.Bitcast(
				new LLVM.Type("i8", 1),
				argument
			)
		));
		let toID = new LLVM.ID();
		preamble.append(new LLVM.Set(
			new LLVM.Name(toID, false),
			new LLVM.Bitcast(
				new LLVM.Type("i8", 1),
				instruction
			)
		));

		preamble.append(new LLVM.Call(
			new LLVM.Type("void", 0),
			new LLVM.Name("llvm.memcpy.p0i8.p0i8.i64", true),
			[
				new LLVM.Argument(
					new LLVM.Type("i8", 1),
					new LLVM.Name(toID.reference(), false)
				),
				new LLVM.Argument(
					new LLVM.Type("i8", 1),
					new LLVM.Name(fromID.reference(), false)
				),
				new LLVM.Argument(
					new LLVM.Type("i64", 0),
					new LLVM.Name(sizeID.reference(), false)
				),
				new LLVM.Argument(
					new LLVM.Type('i1', 0),
					new LLVM.Constant("0")
				)
			]
		));

		return {
			preamble,
			instruction
		};
	}
}

module.exports = Structure;