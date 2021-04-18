const path = require('path');
const BNF = require('bnf-parser');

const helper = require('../helper/error.js');

const LLVM = require('./../middle/llvm.js');
const Function = require('./function.js');
const TypeDef  = require('./typedef.js');
const Structure = require('./struct.js');
const TypeRef = require('./typeRef.js');
const Import  = require('./import.js');

// const { Namespace, Namespace_Type } = require('./namespace.js');
const Parse = require('./../parser/parse.js');
const fs = require('fs');
const Template = require('./template.js');

class File {
	constructor (project, id, filepath) {
		this.project = project;
		this.path = filepath;
		this.id = id;

		this.data = "";

		this.names = {};

		let prim = this.project.getPrimative();
		if (prim) {
			let lib = new Import(this, null);
			lib.inject(prim);
			this.names["*"] = lib;
		}

		this.exports = [];
		this.imports = [];
	}



	parse () {
		console.info("Parsing:", this.path);

		this.data = fs.readFileSync(this.path, 'utf8').replace(/\n\r/g, '\n');
		let syntax = Parse(this.data, this.path);

		// read in imports, templates, functions
		for (let element of syntax.tokens) {
			// Ignore comments
			if (element.type == "comment") {
				continue;
			} else if (element.type == "external") {
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
			} else if (element.type == "library") {
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
			} else {
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
				abstract = !external;
				// continue to function case
			case "function":
				space = new Function(this, element, external, abstract);
				break;
			case "import":
				space = new Import(this, element);
				break;
			case "alias":
				space = new Alias(this, element);
				break;
			case "struct":
				space = new Structure(this, element);
				break;
			default:
				throw new Error(`Unexpected file scope namespace type "${element.type}"`);
		}

		if (!this.names[space.name]) {
			this.names[space.name] = space;
		} else if (
			!this.names[space.name].merge ||
			!this.names[space.name].merge(space)
		) {
			console.error("Multiple definitions of same namespace");
			console.error("  name :", space.name);
			console.error("   1st :", this.names[space.name].ref.toString());
			console.error("   2nd :", space.ref.toString());
			this.project.markError();
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

	getType (typeList, template = []) {
		let res = null;
		// File access must be direct
		if (typeList[0][0] == "." || Number.isInteger(typeList[0][0])) {
			res = this.names[typeList[0][1]];

			if (res) {
				if (res instanceof Template || typeList.length > 1) {
					return res.getType(typeList.slice(1), template);
				} else {
					return new TypeRef(0, res);
				}
			}
		} else {
			return null;
		}

		// If the name isn't defined in this file
		// Check other files
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getType(typeList, template);
		}

		return null;
	}

	getFunction (access, signature, template) {
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

		// If the name isn't defined in this file in a regular name space
		//   Check namespace imports
		if (this.names["*"] instanceof Import) {
			return this.names["*"].getFunction(access, signature, template);
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

	throw (msg, refStart, refEnd) {
		// let area = BNF.Message.HighlightArea(this.data, refStart, refEnd);
		let area = helper.CodeSection(this.data, refStart, refEnd);
		console.error(`\n${this.path}:\n ${msg}\n${area.replace(/\t/g, '  ')}`);
		this.project.markError();
	}


	link () {
		for (let key in this.names) {
			this.names[key].link();
		}

		for (let external of this.exports) {
			this.registerExport(external);
		}
	}


	compile () {
		let fragment = new LLVM.Fragment();
		fragment.append(new LLVM.Comment(`ModuleID = '${this.getRelative()}'`));

		for (let key in this.names) {
			let res = this.names[key].compile();
			fragment.append(res);
		}

		return fragment;
	}
}

module.exports = File;