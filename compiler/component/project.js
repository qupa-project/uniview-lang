const Primative = require('../primative/main.js');

const { Generator_ID } = require('./generate.js');
const LLVM = require('./../middle/llvm.js');
const File = require('./file.js');

const { dirname, resolve } = require('path');
const fs = require('fs');
const path = require('path');

const base = new LLVM.Raw(`attributes #1 = { nounwind "unsafe-fp-math"="false" "use-soft-float"="false" }
declare void @llvm.memmove.p0i8.p0i8.i64 (i8*, i8*, i64, i1)
declare void @llvm.memcpy.p0i8.p0i8.i64 (i8*, i8*, i64, i1)`);

class Project {
	constructor(rootPath, config = {}) {
		this.rootPath = rootPath;
		this.files  = [];
		this.idGen = new Generator_ID(Math.floor(Math.random()*(2**20)));

		this.config = {
			caching: config.caching === undefined ? true : config.caching
		};

		Primative.Generate(this);

		this.exports = [];
		this.error = false;

		this.includes = [];
	}

	import (path, entry = false, relation = this.rootPath) {
		let searchDir = [
			dirname(relation),
			resolve(__dirname, "../../std/"),
		];

		let res = null;
		for (let dir of searchDir) {
			res = resolve(dir, path);
			let search;
			try {
				search = fs.lstatSync(res);
				if (!search.isFile())
					throw "Not file";
			} catch (e) {
				res = null;
			}

			if (res !== null) {
				break;
			}
		}

		if (res === null) {
			console.error('\n' +
				`Error: Cannot import file, as it does not exist\n` +
				`  ${path}\n`
			);
			process.exit(0);
		}
		path = res;

		for (let file of this.files) {
			if (file.getPath() == path) {
				return file;
			}
		}

		let temp = new File(this, this.idGen.next(), path);
		this.files.push(temp);
		temp.parse();

		if (entry === true) {
			let main = temp.getMain();
			if (!main) {
				console.error(`Error: Entry file does not contain a main entry`);
				process.exit(1);
			}
			if (main.instances.length > 1) {
				console.error('Error: Multiple definitions of main in root file');
				process.exit(1);
			}
			main.instances[0].markExport();
		}

		return temp;
	}

	include (type, filename) {
		// Shorten the filepath for better logging
		filename = path.relative(this.rootPath, filename);

		console.info("Including:", filename);
		this.includes.push([
			type,
			filename
		]);
	}
	hasIncluded (filename) {
		return this.includes
			.map(x => x[1])
			.includes(filename);
	}

	/**
	 * Returns the primative library
	 */
	getPrimative () {
		return this.files[0];
	}

	/**
	 *
	 * @param {File} file
	 */
	inject (file) {
		this.files.push(file);
	}

	registerExport (name) {
		if (this.exports.indexOf(name) == -1) {
			this.exports.push(name);
			return true;
		} else {
			return false;
		}
	}

	link (){
		for (let file of this.files) {
			file.link();
		}
	}

	markError () {
		this.error = true;
	};


	compile () {
		let fragment = new LLVM.Fragment();

		for (let file of this.files) {
			let res = file.compile();
			fragment.append(res);
			fragment.append(new LLVM.WPad(3));
		}
		fragment.append(new LLVM.WPad(3));
		fragment.append(base);

		return fragment;
	}
}


module.exports = Project;