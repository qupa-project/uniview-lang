const { SyntaxNode } = require('bnf-parser');

const LLVM = require('../middle/llvm.js');
const Flattern = require('../parser/flatten.js');
const TypeRef = require('./typeRef.js');

const Function = require('./function.js');

const Primitive = {
	types: require('./../primative/types.js')
};


class Trait {
	constructor (ctx, ast) {
		this.ctx = ctx;
		this.name = ast.value[0].value;
		this.ast = ast;
		this.ref = ast.ref.start;

		this.names = {};

		this.impls = [];
	}

	getFunction(access, signature, template) {
		for (let imp of this.impls) {
			let res = imp.getFunction(access, signature, template);
			if (res) {
				return res;
			}
		}

		return null;
	}

	getFile() {
		return this.ctx.getFile();
	}

	getType(access, stack) {
		if ( access.length == 0 ) {
			return new TypeRef(this);
		}

		if (access instanceof SyntaxNode && access.value[1].value == "Self") {
			if (access.value[2].value.length != 0) {
				return null;
			}

			return new TypeRef(
				this,
				["@", "$"].includes(access.value[0].value),
				access.value[0].value == "$"
			);
		}

		return this.ctx.getType(access, stack);
	}

	bindImplementation(impl) {
		for (let name in this.names) {
			this.names[name].ctx = impl; // swap the context  (ensures Self links properly)
			this.names[name].relink();

			if (!impl.names[name]) {
				impl.getFile().throw(
					`Error: Namespace "${name}" not present in implementation of trait ${this.name} for ${impl.struct.name}`,
					impl.ref,
					impl.endRef
				);
				this.ctx.getFile().throw(
					`  Above implementation is missing function "${name}" from the below snippet`,
					this.ref,
					this.names[name].ref
				);
			} else {
				this.names[name].ensureEquivalence(impl.names[name]);
			}
		}

		for (let name in impl.names) {
			if (!this.names[name]) {
				impl.getFile().throw(
					`Error: Implementation has extra namespace "${name}" present in trait ${this.name} implementated for ${impl.struct.name}`,
					impl.ref,
					impl.names[name].ref
				);
			}
		}

		this.impls.push(impl);
	}

	parse () {}

	link () {
		if (this.linked) {
			return;
		}

		for (let node of this.ast.value[2].value) {
			switch (node.type) {
				case "comment":
					break;
				case "function":
					let space = new Function(this, node, false, false);

					if (!this.names[space.name]) {
						this.names[space.name] = space;
					} else if ( !this.names[space.name].merge ||
						!this.names[space.name].merge(space) ) {

						this.getFile().throw(
							`Name collision between functions with the same name "${space.name}" and identical signatures`,
							this.names[space.name].ref,
							space.ref
						);
						this.project.markError();
						return false;
					}

					break;
				default:
					throw new Error(`Unexpected attribute ${node.type}`);
			}
		}

		// Link all successful functions
		for (let name in this.names) {
			this.names[name].link();
		}

		this.linked = true;
	}

	compile () {
	}

	toLLVM() {
		return new LLVM.Fragment();
	}
}

module.exports = Trait;