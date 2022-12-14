const path = require('path');
const BNF = require('bnf-parser');

const helper = require('../helper/error.js');

const LLVM = require('./../middle/llvm.js');
const Function = require('./function.js');
const TypeDef  = require('./typedef.js');
const Structure = require('./struct.js');
const Trait = require('./trait.js');
const Implement = require('./impl.js');
const TypeRef = require('./typeRef.js');
const Import  = require('./import.js');

// const { Namespace, Namespace_Type } = require('./namespace.js');
const Parse = require('./../parser/parse.js');
const fs = require('fs');
const Template = require('./template.js');

class File {
	constructor (project, id, filepath) {
		this.project = project;
		this.path    = filepath;
		this.relPath = path.relative(this.project.rootPath, this.path);
		this.id = id;

		this.data = "";

		this.represent = this.id.toString(36);

		this.names = {};

		this.impls = [];

		let prims = this.project.getPrimatives();
		let lib = new Import(this, null);
		this.names["*"] = lib;
		prims.map(x => lib.inject(x))

		this.exports = [];
		this.imports = [];
	}



	parse () {
		console.info("Parsing:", this.relPath);

		this.data = fs.readFileSync(this.path, 'utf8').replace(/\n\r/g, '\n');
		let syntax = Parse(this.data, this.path);

		// read in imports, templates, functions
		for (let element of syntax.value) {
			// Ignore comments
			switch (element.type) {
				case "external":
					switch (element.value[0].value) {
						case "assume":
							for (let inner of element.value[1].value){
								this.register(inner, true);
							}
							break;
						case "export":
							for (let inner of element.value[1].value){
								this.exports.push(inner);
							}
							break;
						default:
							console.error(`Error: Unknown external type "${element.value[0].value}"`);
							this.project.markError();
							return false;
					}
					break;
				case "library":
					let inner = element.value[0];
					if (inner.type == "import") {
						inner.value = [
							inner.value[0].value[1],
							inner.value[1]
						];
						this.register(inner);
					} else {
						console.error(`  Parse Error: Unknown library action "${inner.type}"`);
						this.project.markError();
						return false;
					}
					break;
				case "include":
					this.include(element.value[0], element.value[1], element.ref);
					break;
				default:
					this.register(element);
			}
		}

		// After main parse
		//   To make logging clearer
		for (let name in this.names) {
			if (this.names[name] instanceof Import) {
				this.names[name].load();
			}
		}
	}

	register (element, external = false) {
		let space = null;
		let abstract = false;
		switch (element.type) {
			case "type_def":
				space = new TypeDef(this, element, external);
				break;
			case "function_outline":
				abstract = !external; // continue to function case
			case "function":
				space = new Function(this, element, external, abstract);
				break;
			case "function_redirect":
				space = new Function(this, element, external, false);
				space.instances[0].represent = element.value[1];
				break;
			case "import":
				space = new Import(this, element);
				break;
			case "struct":
				space = new Structure(this, element, external);
				break;
			case "trait":
				space = new Trait(this, element, external);
				break;
			case "impl":
				this.impls.push( new Implement(this, element) );
				return;
			default:
				throw new Error(`Unexpected file scope namespace type "${element.type}"`);
		}

		if (!this.names[space.name]) {
			this.names[space.name] = space;
		} else if (
			!this.names[space.name].merge ||
			!this.names[space.name].merge(space)
		) {

			this.throw(
				`Multiple definitions of namespace "${space.name}"`,
				this.names[space.name].ref.index < space.ref.index ? // first
					this.names[space.name].ref : space.ref,
				this.names[space.name].ref.index > space.ref.index ? // second
					this.names[space.name].ref : space.ref
			);
			return false;
		}
	}

	/**
	 * Must be ran after main linking
	 * @param {BNF_SyntaxNode} element
	 */
	registerExport (element) {
		if (element.type != "function_outline") {
			this.getFile().throw(`Link Error: Unable to export non-functions in current version`, element.ref.start);
			return;
		}

		let space = new Function(this, element, true, false);
		space.link();

		if (!this.project.registerExport(space.name)) {
			this.getFile().throw(
				`Link Error: Unable to export "${space.name}" as name is already in use`,
				space.ref
			);
		}

		if (this.names[space.name]) {
			this.names[space.name].registerExport(space.instances[0]);
		} else {
			this.getFile().throw(`Link Error: Unable to export function "${space.name}"`, element.ref.start);
		}
	}

	getType (access, stack = []) {
		if (access.length == 0) {
			return null;
		}

		if (access.length > 0) {
			let term = access[0];


			switch (term.type) {
				case "name":
				case "access_static":
					break;
				default:
					return null;
			}

			if (this.names[term.value]) {
				let res = this.names[term.value].getType(access.slice(1), stack);
				if (res) {
					return res;
				}
			}
		}

		// Circular loop
		if (stack.includes(this.id)) {
			return null;
		}
		stack.push(this.id);

		// If the name isn't defined in this file
		// Check other files
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getType(access, stack);
		}

		return null;
	}


	getFunction (access, signature, stack = []) {
		if (access.length == 0) {
			return null;
		}

		if (access.length > 1) {
			let term = access[0];
			switch (term.type) {
				case "name":
				case "access_static":
					break;
				default:
					return null;
			}

			let res = this.names[term.value].getFunction(access.slice(1), signature, stack);
			if (res) {
				return res;
			}
		}

		// Circular loop
		if (stack.includes(this.id)) {
			return null;
		}
		stack.push(this.id);

		// If the name isn't defined in this file
		// Check other files
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getFunction(access, signature, stack);
		}

		return null;
	}

	getTrait (access, stack = []) {
		if (access.length == 0) {
			return null;
		}

		if (access.length > 1) {
			let term = access[0];
			switch (term.type) {
				case "name":
				case "access_static":
					break;
				default:
					return null;
			}

			let res = this.names[term.value].getType(access.slice(1), stack);
			if (res) {
				return res;
			}
		}

		// Circular loop
		if (stack.includes(this.id)) {
			return null;
		}
		stack.push(this.id);

		// If the name isn't defined in this file
		// Check other files
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getType(access, stack);
		}

		return null;
	}

	getMain () {
		return this.names['main'];
	}

	getID () {
		return this.id;
	}
	getFile () {
		return this;
	}
	getFileID () {
		return this.getID();
	}
	getPath () {
		return this.path;
	}
	getRelative () {
		return path.relative(this.project.rootPath, this.path);
	}

	getFile () {
		return this;
	}
	import (filename) {
		return this.project.import(filename, false, this.path);
	}


	include (type, filename, ref) {
		let res = path.resolve(
			path.dirname(this.path),
			filename
		);

		// Check if this has already been included
		if (this.project.hasIncluded(res)) {
			return;
		}

		// Check the include type is valid
		switch (type) {
			case "llvm":
				type = "--language=ir";
				break;
			default:
				this.throw(
					`Error: Cannot include file, unable to handle include type ${type}`,
					ref.start, ref.end
				);
				return;
		}

		// Check the file exists
		try {
			let search = fs.lstatSync(res);
			if (!search.isFile()) {
				throw "bad";
			}
		} catch (e) {
			this.throw(
				"Error: Cannot include file, as it does not exist\n"+
				`  ${res}`,
				ref.start,
				ref.end
			);
		} finally {
			// Include the file within the project
			this.project.include(
				type,
				res,
				ref
			);
		}

		return;
	}


	throw (msg, refStart, refEnd) {
		// let area = BNF.Message.HighlightArea(this.data, refStart, refEnd);
		let area = helper.CodeSection(this.data, refStart, refEnd);
		console.error(`\n${this.relPath}:\n ${msg.replace(/\n/g, "\n ")}\n${area.replace(/\t/g, '  ')}`);
		this.project.markError();
	}
	warn (msg, refStart, refEnd) {
		// let area = BNF.Message.HighlightArea(this.data, refStart, refEnd);
		let area = helper.CodeSection(this.data, refStart, refEnd);
		console.warn(`\n${this.relPath}:\n ${msg}\n${area.replace(/\t/g, '  ')}`);
	}


	link () {
		for (let key in this.names) {
			this.names[key].link();
		}

		for (let external of this.exports) {
			this.registerExport(external);
		}

		for (let imp of this.impls) {
			imp.link();
		}
	}


	compile () {
		for (let key in this.names) {
			this.names[key].compile();
		}

		for (let imp of this.impls) {
			imp.compile();
		}
	}


	toLLVM () {
		let fragment = new LLVM.Fragment();

		for (let key in this.names) {
			if (
				!(this.names[key] instanceof Structure) &&
				this.names[key] instanceof TypeDef
			) {
				continue;
			}

			let res = this.names[key].toLLVM();
			if (res instanceof LLVM.Fragment) {
				fragment.merge(res);
			} else {
				fragment.append(res);
			}
		}

		for (let imp of this.impls) {
			let res = imp.toLLVM();
			if (res instanceof LLVM.Fragment) {
				fragment.merge(res);
			} else {
				fragment.append(res);
			}
		}

		return fragment;
	}
}

module.exports = File;