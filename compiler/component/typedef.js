const { Generator_ID } = require('./generate.js');
const LLVM = require('./../middle/llvm.js');
const TypeRef = require('./typeRef.js');
let typeIDGen = new Generator_ID();

class TypeDef {
	constructor (ctx, ast, external = false) {
		this.ctx      = ctx;
		this.ast      = ast;
		this.ref      = ast.ref.start;
		this.external = external;

		this.native = false;
		this.linked = false;

		this.id = typeIDGen.next();

		this.represent = "unknown";
		this.name = "unknown";
		this.alignment = 0;
		this.size = 0;

		this.typeSystem = 'linear';

		this.parse();
	}


	getTerm () {
		return null;
	}
	getElement () {
		return null;
	}

	getSize () {
		return this.size;
	}

	getFile() {
		return this.ctx.getFile();
	}
	getFileID() {
		return this.ctx.getFileID();
	}

	getFunction () {
		return null;
	}

	getType(access) {
		return access.length == 0 ? new TypeRef(this) : null;
	}

	getDestructor() {
		return false;
	}
	getCloner() {
		return false;
	}
	hasNestedCloner() {
		return false;
	}


	parse () {
		this.name = this.ast.tokens[0].tokens;
		this.represent = this.external ? this.name : `"${this.name}@${this.ctx.getFileID().toString(36)}"`;
	}

	link () {
		this.size = Number(this.ast.tokens[1].tokens);
		this.linked = true;
		return;
	}

	compile () {
		return new LLVM.Comment(`Assume Typedef: ${this.name} ${this.represent}, ${this.size}`, this.ref);
	}

	toLLVM () {
		return new LLVM.Type(this.represent, 0, this.declared || null);
	}

	/**
	* Generates the code to determine the size of the structure
	* @param {BNF_Reference} ref
	* @returns
	*/
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

module.exports = TypeDef;