const LLVM = require('./../middle/llvm.js');

class Import {
	constructor (ctx, ast) {
		this.ctx      = ctx;
		this.ref      = ast ? ast.ref.start : null;

		let hasAst = ast != null;
		this.name = hasAst ? ast.value[0].value : "*";
		this.files = [];

		if (hasAst) {
			this.files.push({
				file: null,
				path: ast.value[1].value,
				ref: ast.ref.start
			});
		}
	}

	/**
	 *
	 * @param {File} file
	 */
	inject (file) {
		this.files.push({
			file: file,
			path: file.path,
			ref: {
				start: null,
				end: null
			}
		});
	}

	merge (other) {
		if (
			other instanceof Import &&
			this.name == "*"
		) {
			this.files = this.files.concat(other.files);
			return true;
		}

		return false;
	}

	load () {
		let file = this.ctx.getFile();
		for (let extern of this.files) {
			if (!extern.file) {
				extern.file = file.import(extern.path);
			}
		}
	}

	getType (variable, template, stack) {
		for (let extern of this.files) {
			let opt = extern.file.getType(variable, template, stack);
			if (opt) {
				return opt;
			}
		}

		return null;
	}

	getFunction (access, signature, stack) {
		for (let lib of this.files) {
			if (stack.includes(lib.file.id)) {
				continue;
			}

			let opt = lib.file.getFunction(access, signature, stack);
			stack.push(lib.file.id);
			if (opt) {
				return opt;
			}
		}

		return null;
	}

	link () {
		return;
	}

	compile () {}

	toLLVM () {
		let frag = new LLVM.Fragment();
		return frag;
	}

	static From () {

	}
}
module.exports = Import;