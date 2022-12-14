const Flattern = require('../parser/flatten.js');

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

	getType(node, template) {
		if (
			node.length == 1 &&
			template.length == 0 &&
			node[0][1] == "Self"
		) {
			return new TypeRef(this.struct);
		}

		return this.ctx.getType(node, template);
	}

	link () {
		let file = this.ctx.getFile();

		let structToken = this.ast.tokens[0];
		this.struct = this.ctx.getType(Flattern.DataTypeList(structToken));
		if (this.struct == null) {
			file.throw(
				`Cannot implement for known type "${Flattern.DataTypeStr(structToken)}"`,
				this.ref, structToken.ref.end
			);
		}
		this.struct = this.struct.type;

		let traitToken = this.ast.tokens[1];
		if (traitToken) {
			this.trait = this.ctx.getFile().getTrait(Flattern.DataTypeList(traitToken), []);
			if (this.trait == null) {
				file.throw(
					`Cannot implement for unknown trait "${Flattern.DataTypeStr(traitToken)}"`,
					this.ref, structToken.ref.end
				);
			}
		}
		this.represent = this.struct.name + "." + (this.trait?.name || "default");

		for (let node of this.ast.tokens[2].tokens) {
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