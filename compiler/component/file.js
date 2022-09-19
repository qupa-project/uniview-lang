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
		for (let element of syntax.tokens) {
			// Ignore comments
			switch (element.type) {
				case "comment":
					break;
				case "external":
					if (element.tokens[0] == "assume") {
						for (let inner of element.tokens[1]){
							this.register(inner, true);
						}
					} else if (element.tokens[0] == "export") {
						for (let inner of element.tokens[1]){
							this.exports.push(inner);
						}
					} else {
						console.error(`Error: Unknown external type "${element.tokens[0]}"`);
						this.project.markError();
						return false;
					}
					break;
				case "library":
					let inner = element.tokens[0];
					if (inner.type == "import") {
						inner.tokens = [
							inner.tokens[0].tokens[1],
							inner.tokens[1]
						];
						this.register(inner);
					} else {
						console.error(`  Parse Error: Unknown library action "${inner.type}"`);
						this.project.markError();
						return false;
					}
					break;
				case "include":
					this.include(element.tokens[0], element.tokens[1], element.ref);
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
				space.instances[0].represent = element.tokens[1];
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

	getType (typeList, template = [], stack = []) {
		let res = null;
		// File access must be direct
		if (typeList[0][0] == "." || Number.isInteger(typeList[0][0])) {
			res = this.names[typeList[0][1]];

			if (res) {
				if (res instanceof Template || typeList.length > 1) {
					return res.getType(typeList.slice(1), template);
				} else {
					return new TypeRef(res);
				}
			}
		} else {
			return null;
		}

		// Circular loop
		if (stack.includes(this)) {
			return null;
		}
		stack.push(this);

		// If the name isn't defined in this file
		// Check other files
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getType(typeList, template);
		}

		return null;
	}

	getFunction (access, signature, template, stack = []) {
		if (access.length < 1) {
			return null;
		}

		let first = access[0];
		let forward = access.slice(1);
		if (Array.isArray(first)) {
			if (first[0] == ".") {
				first = first[1];
			} else {
				return null;
			}
		}

		if (this.names[first]) {
			let res = this.names[first].getFunction(forward, signature, template);
			if (res !== null) {
				return res;
			}
		}

		// Circular loop
		if (stack.includes(this)) {
			return null;
		}
		stack.push(this);

		// If the name isn't defined in this file in a regular name space
		//   Check namespace imports
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getFunction(access, signature, template, stack);
		}

		return null;
	}

	getTrait (access, template, stack = []) {
		if (access.length < 1) {
			return null;
		}

		let first = access[0];
		let forward = access.slice(1);
		if (Array.isArray(first)) {
			if (first[0] == "." || first[0] == 0) {
				first = first[1];
			} else {
				return null;
			}
		}

		if (this.names[first]) {
			let res = this.names[first].getTrait(forward, template);
			if (res !== null) {
				return res;
			}
		}

		// Circular loop
		if (stack.includes(this)) {
			return null;
		}
		stack.push(this);

		// If the name isn't defined in this file in a regular name space
		//   Check namespace imports
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getTrait(access, template, stack);
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