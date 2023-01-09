
const { SyntaxNode } = require('bnf-parser');

const Flatten = require('../parser/flatten.js');

const Function = require('./function.js');
const LLVM = require('../middle/llvm.js');

const TypeRef = require('./typeRef.js');

class Implement {
	constructor (ctx, ast, external = false) {
		this.ctx = ctx;
		this.ast = ast;
		this.ref = ast.ref.start;
		this.endRef = ast.ref.end;

		this.names = {};

		this.trait = null;
		this.struct = null;

		this.represent = "%impl.";
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
				this.struct,
				["@", "$"].includes(access.value[1].value),
				access.value[1].value == "$"
			);
		}

		return this.ctx.getType(access, stack);
	}

	link () {
		let file = this.ctx.getFile();

		let structToken = this.ast.value[0];
		this.struct = this.ctx.getType(structToken);
		if (this.struct == null) {
			file.throw(
				`Cannot implement for known type "${Flatten.AccessToString(structToken)}"`,
				this.ref, structToken.ref.end
			);
			return false;
		}
		this.struct = this.struct.type;

		let traitToken = this.ast.value[1];
		let traitName = "default";
		if (traitToken.type != "blank") {
			let type = this.ctx.getFile().getType(traitToken);
			if (type == null) {
				file.throw(
					`Cannot implement for unknown trait "${Flatten.AccessToString(traitToken)}"`,
					this.ref, structToken.ref.end
				);
				return false;
			}

			if (type.lent) {
				file.throw(
					`Cannot implement for a lent trait "${Flatten.AccessToString(traitToken)}"`,
					this.ref, structToken.ref.end
				);
				return false;
			}

			traitName = type.type.name;
			this.trait = type.type;
		}
		this.represent = this.struct.name + "." + traitName;

		for (let node of this.ast.value[2].value) {
			switch (node.type) {
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


		if (this.trait) {
			this.trait.bindImplementation(this);
		}
		this.struct.bindImplementation(this);
	}

	getFunction (access, signature, template) {
		if (access.length != 1) {
			return null;
		}

		let name = access[0][1];
		if (this.names[name]) {
			return this.names[name].getFunction([], signature, template);
		}

		return null;
	}


	compile () {
		for (let name in this.names) {
			this.names[name].compile();
		}
	}

	toLLVM () {
		let out = new LLVM.Fragment();

		for (let name in this.names) {
			out.append(this.names[name].toLLVM());
		}

		return out;
	}
}

module.exports = Implement;