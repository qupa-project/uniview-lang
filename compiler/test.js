const Project = require('./component/project.js');

const util = require('util');
const { resolve, dirname } = require('path');
const fs = require('fs');
const os = require('os');

const exec = util.promisify( require('child_process').exec );
const writeFile = util.promisify( fs.writeFile );
const readFile = util.promisify( fs.readFile );
const exists = util.promisify( fs.exists );
const mkdir = util.promisify( fs.mkdir );

let flags = {
	clang: process.argv.includes('--bin'),
	exec: process.argv.includes('--exec')
};

if (flags.exec) {
	flags.clang = true;
}

let config = {
	caching: true,
	output: "out",
	ext: os.platform() == "win32" ? "exe" :
		os.platform() == "darwin" ? "app" :
		"out",
	source: false,
	execute: false
};

let total = 0;
let completed = 0;
let fails = 0;

async function Compile(root, id) {
	let msg  = `  File : ${root}\n`;
	    msg += `  ID   : ${id}\n`;
	let failed = false;

	// Load required files
	let project = new Project(root, {
		caching: config.caching
	});
	project.import(root, true);

	try {
		// Link elements
		msg += "Linking...\n";
		project.link();
		if (project.error) {
			throw new Error("Link Error");
		}

		// Compile to LLVM
		let asm;
		if (!failed) {
			msg += "Processing...\n";
			asm = project.compile();
			if (project.error) {
				throw new Error("Uncompilable errors");
			}
		}

		let runtime_path = resolve(__dirname, "./../runtime/runtime.cpp");
		let ir_path = resolve(__dirname, `./../test/temp/${id}.ll`);
		let log_path = resolve( dirname(root), "./out.txt" );
		let exe_path = resolve(__dirname, `./../test/temp/${id}.${config.ext}`);

		// Compile completely using clang
		if (!failed && ( flags.clang || flags.llvm)) {
			msg += "Binerising...\n";
			let data = asm.flattern();
			await writeFile(ir_path, data, 'utf8');

			await exec(`clang++ ${runtime_path} -x ir ${ir_path} -o ${exe_path}`);
		}

		// Test execution
		if (!failed && flags.clang && flags.exec) {
			msg += "Executing...\n";
			let out = await exec(exe_path);

			if (await exists(log_path)) {
				let log = (await readFile(log_path, 'utf8'))
					.replace(/\r\n/g, '\n')
					.replace(/ \n/g, '\n');
				let io = out.stdout
					.replace(/\r\n/g, '\n')
					.replace(/ \n/g, '\n');
				if (io != log) {
					console.log(81, [io, log])
					throw new Error("Output does not match log");
				}
			}
		}
	} catch (e) {
		msg += e.message;
		failed = true;
		fails++;
	}

	completed++;

	console.info("\nTest", completed, ' of ', total);
	console.log(msg);
	console.log(failed ? "  FAILED" : "  success");

	return;
}




let tests = [
	"cast/main.uv",
	"compare/main.uv",
	"first-execution/main.uv",
	"library-behaviour/main.uv",
	"math/main.uv",
].map( x => {
	return resolve("./test/pre-alpha", x);
});
total = tests.length;

async function Test () {
	let test_path = resolve(__dirname, "../test/temp/");
	console.log('Test space', test_path);
	if (!await exists(test_path) ) {
		await mkdir(test_path);
	}

	let tasks = [];
	let id = 0;
	for (let file of tests) {
		tasks.push( Compile(file, id++) );
	}

	await Promise.all(tasks);

	console.log(`\nFailed ${fails} of ${tests.length}`);

	if (fails > 0) {
		process.exit(1);
	} else {
		process.exit(0);
	}
}

Test();