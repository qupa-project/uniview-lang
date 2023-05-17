const LLVM = require('./../middle/llvm.js');
const Flattern = require('../parser/flatten.js');
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
		this.size = -1;

		this.ir = new LLVM.Fragment();
	}

	getSize () {
		if (this.size == -1) {
			this.size = this.typeRef.type.getSize();
		}

		return this.size;
	}

	toLLVM() {
		let type = this.typeRef.toLLVM(this.declared);
		if (!this.typeRef.native) {
			type.offsetPointer(-1);
		}
		return type;
	}
}


class Structure extends TypeDef {
	constructor (ctx, ast, external = false) {
		super(ctx, ast, external);
		this.terms = [];
		this.linked = false;
		this.size = -1;
		this.alignment = 0;

		this.nestedCloner = null;

		this.defaultImpl = null;
		this.impls = [];
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
		} else {
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

	getFunction(access, signature, template) {
		if (this.defaultImpl) {
			return this.defaultImpl.getFunction(access, signature, template);
		}

		return null;
	}

	getDestructor () {
		let res = this.impls
			.filter(x => x.trait.name == "Drop")
			.map(x => x.names["drop"].instances[0]);

		if (res.length == 1) {
			return res[0];
		}

		return null;
	}

	getCloner () {
		let res = this.impls
			.filter(x => x.trait.name == "Clone")
			.map(x => x.names["clone"].instances[0]);

		if (res.length == 1) {
			return res[0];
		}

		return null;
	}

	hasNestedCloner() {
		if (this.nestedCloner !== null) {
			// Do nothing value already cached
		} else if (this.getCloner() !== null) {
			this.nestedCloner = true;
		} else {
			this.nestedCloner = this.terms
				.map(x => x.typeRef.type.hasNestedCloner())
				.reduce((prev, curr) => prev || curr, false);
		}

		return this.secondHandClone;
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
		if (type.native) {
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
				val.type = type.toLLVM(ref).offsetPointer(1);
			}
		}

		return {
			preamble: preamble,
			instruction: val,
			type: type.duplicate()
		};
	}

	parse () {
		this.name = this.ast.value[0].value;
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

		for (let node of this.ast.value[1].value) {
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
		let name = node.value[1].value;
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
		let typeNode = node.value[0];
		let typeRef = this.getFile().getType(node.value[0]);
		if (typeRef === null) {
			this.ctx.getFile().throw(
				`Error: Unknown type ${Flattern.AccessToString(node.value[0])}`,
				typeNode.ref.start,
				typeNode.ref.end
			);
			return false;
		}

		if (typeRef.type == Primative.types.void) {
			this.ctx.getFile().throw(
				`Error: Structures cannot include void type as an attribute`,
				typeNode.ref.start,
				typeNode.ref.end
			);
			return false;
		}

		// Check child attribute is linked for valid size
		if (!typeRef.type.linked) {
			type.link([this, ...stack]);
		}

		let term = new Struct_Term(
			name,
			new TypeRef(typeRef.type),
			node.ref.start
		);
		this.terms.push(term);
		return true;
	}

	bindImplementation (impl) {
		if (impl.trait == null) {
			if (this.defaultImpl) {
				this.ctx.getFile().throw(
					`Error: Struct ${this.name} already has a default implementation, however a new one is attempting to be assigned`,
					this.defaultImpl.ref,
					impl.ref
				)
			}

			this.defaultImpl = impl;
		} else {
			if (this.impls.filter(x => x.trait == impl.trait).length > 0) {
				this.ctx.getFile().throw(
					`Error: Struct ${this.name} already has an implementation for trait ${impl.trait.name}, however a new one is attempting to be assigned`,
					this.defaultImpl.ref,
					impl.ref
				);
			}

			this.impls.push(impl);
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
	 * @param {LLVM.Argument} to
	 */
	cloneInstance(argument, to, ref) {
		throw new Error("Old code path");
	}


	getSize () {
		if (this.size == -1) {
			this.alignment = Math.max.apply(null,
				this.terms
					.map(x => x.typeRef.type)
					.map(x => x.native ? x.size : x.alignment)
			);

			this.size = this.terms
				.map(x => x.getSize())
				.map(x => Math.ceil(x/this.alignment)*this.alignment)
				.reduce((tally, curr) => tally + curr, 0);
		}

		return this.size;
	}
}

module.exports = Structure;