const Function = require('./function.js');
const Structure = require('./struct.js');
const LLVM = require('./../middle/llvm.js');

class Class extends Structure {
	constructor (ctx, ast, external = false) {
		super(ctx, ast, external);
		this.names = {};
		this.meta = "CLASS";
	}

	parse () {
		this.name = this.ast.tokens[0].tokens;
		this.represent = "%class." + (
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
						return;
					}
					break;
				case "function":
					let space = new Function(this, node, false, false);

					if (!this.names[space.name]) {
						this.names[space.name] = space;
					} else if (
						!this.names[space.name].merge ||
						!this.names[space.name].merge(space)
					) {
						let first = this.names[space.name].ref.index < space.ref.index ?
						this.names[space.name].ref : space.ref;
						let second = this.names[space.name].ref.index > space.ref.index ?
						this.names[space.name].ref : space.ref;

						this.getFile().throw(
							`Multiple definitions of same name ${space.name}`,
							first, second
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
		super.compile();

		for (let name in this.names) {
			this.names[name].compile();
		}
	}

	toLLVM () {
		let out = new LLVM.Fragment();
		out.append(super.toLLVM());

		for (let name in this.names) {
			out.append(this.names[name].toLLVM());
		}

		return out;
	}
}


module.exports = Class;