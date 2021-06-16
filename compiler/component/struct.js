const LLVM = require('./../middle/llvm.js');
const Flattern = require('../parser/flattern.js');
const TypeDef = require('./typedef.js');
const TypeRef = require('./typeRef.js');

const Primative = {
	types: require('./../primative/types.js')
};


class Struct_Term {
	constructor(name, typeRef, ref) {
		this.name = name;
		this.typeRef = typeRef;
		this.declared = ref;
		this.size = typeRef.type.size;
		this.typeSystem = "linear";

		this.ir = new LLVM.Fragment();
	}

	toLLVM() {
		return this.typeRef.toLLVM(this.declared, true);
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
	 * @param {BNF_Node|Number} name
	 * @returns {Object}
	 */
	getTerm (name) {
		let found = false;
		let i = 0;
		if (typeof(name) == "number") {
			found = i < this.terms.length;
			i = name;
		} else{
			for (; i<this.terms.length && !found; i++) {
				if (this.terms[i].name == name) {
					found = true;
					break;
				}
			}
		}
		if (!found) {
			return null;
		}

		let type = this.terms[i].typeRef.duplicate();
		return {
			index: i,
			type: type
		};
	}

	indexOfTerm (name) {
		for (let i=0; i<this.terms.length; i++) {
			if (this.terms[i].name == name) {
				return i;
			}
		}

		return -1;
	}

	getTermCount () {
		return this.terms.length;
	}

	/**
	 *
	 * @param {Number} i
	 * @param {LLVM.Argument} register
	 * @param {BNF_Reference} ref
	 * @returns {Object}
	 */
	accessGEPByIndex (i, register, ref, reading = true) {
		let preamble = new LLVM.Fragment();
		let type = this.terms[i].typeRef;

		// Bind the gep value to a register
		let gepID = new LLVM.ID(ref);
		preamble.append(new LLVM.Set(
			new LLVM.Name(gepID, false, ref),
			new LLVM.GEP(
				register.type.duplicate().offsetPointer(-1),
				register,
				[
					new LLVM.Argument(
						Primative.types.i32.toLLVM(),
						new LLVM.Constant("0", ref),
						ref
					),
					new LLVM.Argument(
						Primative.types.i32.toLLVM(),
						new LLVM.Constant(i.toString(), ref)
					)
				],
				ref
			),
			ref
		));

		// The register is now the value representation
		let val = new LLVM.Argument(
			type.toLLVM(ref),
			new LLVM.Name(gepID.reference(), false, ref),
			ref
		);

		// Non-linear type - hence the value must be loaded
		if (type.type.typeSystem == "normal") {
			if (reading) {
				let id = new LLVM.ID();
				preamble.append(new LLVM.Set(
					new LLVM.Name(id, false, ref),
					new LLVM.Load(
						type.toLLVM(),
						val.name,
						ref
					),
					ref
				));

				val = new LLVM.Argument(
					type.toLLVM(ref),
					new LLVM.Name(id.reference(), false, ref),
					ref
				);
			} else {
				val.type = type.toLLVM(ref, false, true);
			}
		}

		return {
			preamble: preamble,
			instruction: val,
			type: type.duplicate()
		};
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

		this.size = 0;
		for (let node of this.ast.tokens[1].tokens) {
			switch (node.type) {
				case "comment":
					break;
				case "struct_attribute":
					if (this.linkTerm(node, stack) == false) {
						return false;
					}
					break;
				default:
					throw new Error(`Unexpected attribute ${node.type}`);
			}
		}
		this.linked = true;
	}

	linkTerm (node, stack = []) {
		let name = node.tokens[1].tokens;
		let index = this.indexOfTerm(name);
		if (index != -1) {
			this.ctx.getFile().throw(
				`Error: Multiple use of term "${name}" in struct`,
				this.terms[index].declared,
				node.ref.end
			);
			return false;
		}

		// Get attribute type
		let typeNode = node.tokens[0];
		let typeRef = this.ctx.getType(Flattern.DataTypeList(typeNode));
		if (typeRef === null) {
			this.ctx.getFile().throw(
				`Error: Unknown type ${Flattern.DataTypeStr(typeNode)}`,
				typeNode.ref.start,
				typeNode.ref.end
			);
			return false;
		}

		// Check a structure is not including a class attribute
		if (this.meta != "CLASS" && typeRef.type.meta == "CLASS") {
			this.ctx.getFile().throw(
				`Error: Structures cannot include classes as attributes`,
				this.ref,
				node.ref.end
			);
			return false;
		}

		// Check child attribute is linked for valid size
		if (!typeRef.type.linked) {
			type.link([this, ...stack]);
		}

		let term = new Struct_Term(
			name,
			new TypeRef(0, typeRef.type),
			node.ref.start
		);
		this.terms.push(term);
		this.size += term.size;
		return true;
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
			new LLVM.Alloc(type.toLLVM())
		));
		let instruction = new LLVM.Argument(
			type.toLLVM(),
			new LLVM.Name(storeID.reference(), false)
		);

		let size = this.sizeof(ref);
		preamble.merge(size.preamble);

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
				size.instruction,
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