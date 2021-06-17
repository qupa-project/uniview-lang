const LLVM = require('./../middle/llvm.js');

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

	getFunction () {
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
		this.name = "Either";
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

		this.size = max + 1;
		return this.size;
	}

	toLLVM(ref) {
		return new LLVM.Struct(
			new LLVM.Name(this.represent, false, ref),
			[
				new LLVM.Type(`<${this.getSize()} x i8>`, 0),
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
				new LLVM.Constant(this.getSize()),
				ref
			)
		};
	}
}


module.exports = Either;