const LLVM = require('./../middle/llvm.js');

class Import {
	constructor (ctx, ast) {
		this.ctx      = ctx;
		this.ref      = ast ? ast.ref.start : null;

		this.name = ( ast && ast.tokens[1] && ast.tokens[1].tokens ) ? ast.tokens[1].tokens : "*";
		this.files = [];

		if (ast) {
			this.files.push({
				file: null,
				path: ast.tokens[0],
				ref: ast.ref.start
			});
		}
	}

	/**
	 *
	 * @param {File} file
	 */
	inject(file) {
		this.files.push({
			file: file,
			path: file.path,
			ref: {
				start: null,
				end: null
			}
		});
	}

	merge(other) {
		if (
			other instanceof Import &&
			this.name == "*"
		) {
			this.files = this.files.concat(other.files);
			return true;
		}

		return false;
	}

	load() {
		let file = this.ctx.getFile();
		for (let extern of this.files) {
			if (!extern.file) {
				extern.file = file.import(extern.path);
			}
		}
	}

	getType(variable, template) {
		for (let extern of this.files) {
			let opt = extern.file.getType(variable, template);
			if (opt) {
				return opt;
			}
		}

		return null;
	}

	getFunction(access, signature, template) {
		for (let lib of this.files) {
			let opt = lib.file.getFunction(access, signature, template);
			if (opt) {
				return opt;
			}
		}

		return null;
	}

	link() {
		return;
	}

	compile() {
		let frag = new LLVM.Fragment();
		frag.append(new LLVM.Comment(`Imported under ${this.name}:`))
		for (let extern of this.files) {
			frag.append(new LLVM.Comment(`  ${extern.file.getRelative()}`));
		}

		return frag;
	}

	static From() {

	}
}
module.exports = Import;