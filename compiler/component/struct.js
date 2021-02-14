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
	getTerm(type, name, register) {
		let found = false;
		let i = 0;
		for (; i<this.terms.length && !found; i++) {
			if (this.terms[i].name == name.tokens) {
				found = true;
				break;
			}
		}
		if (!found) {
			return null;
		}

		let res = this.accessGEPByIndex(i, register, name.ref.start);

		return {
			preamble: res.preamble,
			instruction: res.instruction,
			index: i,
			type: res.type
		};
	}

	getTermCount() {
		return this.terms.length;
	}

	accessGEPByIndex(i, register, ref) {
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

	parse() {
		this.name = this.ast.tokens[0].tokens;
		this.represent = "%struct." + (
			this.external ? this.name : `${this.name}.${this.ctx.getFileID().toString(36)}`
		);
	}

	link(stack = []) {
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

	compile() {
		let types = [];
		for (let name in this.terms) {
			types.push(this.terms[name].toLLVM());
		}

		return new LLVM.Struct(
			new LLVM.Name(this.represent, false, this.ref),
			types,
			this.ref
		);
	}
}

module.exports = Structure;