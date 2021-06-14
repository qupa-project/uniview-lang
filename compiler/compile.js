#!/usr/bin/env node
"use strict";

const Project = require('./component/project.js');

const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, spawn, spawnSync } = require('child_process');

const version = "Uniview Compiler v0.0.3 Alpha";
const root = path.resolve("./");





/*------------------------------------------
	Compiler configuration flags
------------------------------------------*/
if (process.argv.includes("--version")) {
	console.info(version);
	process.exit(0);
}

let config = {
	output: "out",
	source: false,
	execute: true,
	compileOnly: false,
	verifyOnly: false,
	optimisation: "0",
};
let index = process.argv.indexOf('-o');
if (index != -1 && index > 2) {
	config.output = process.argv[index+1] || "out";
}
if (process.argv.includes('--execute')) {
	config.execute = true;
}
if (process.argv.includes('--verifyOnly')) {
	config.verifyOnly = true;
	config.execute = false;
}
if (process.argv.includes('--compileOnly')) {
	config.compileOnly = true;
	config.execute = false;
}
index = process.argv.indexOf('-s');
if (index != -1) {
	config.source = process.argv[index+1] || "asm";
}
index = process.argv.indexOf('-opt');
if (index != -1) {
	config.optimisation = String(
		Math.min(3, Number(process.argv[index+1]) || 0)
	);
}

if (config.execute + config.verifyOnly + config.compileOnly > 1) {
	console.error("Invalid arguments");
	process.exit(1);
}




/*------------------------------------------
	Compilation to LLVM
------------------------------------------*/
// Load required files
let origin = path.resolve(root, process.argv[2]);
let project = new Project(root, {
	caching: config.caching
});
project.import(origin, true);

// Link elements
console.info("Linking...");
project.link();
if (project.error) {
	console.error("\nLinker error");
	process.exit(1);
}

// Compile to LLVM
console.info("Processing...");
project.compile();
if (project.error) {
	console.error("\nUncompilable errors");
	process.exit(1);
}
let asm = project.toLLVM();


if (config.verifyOnly) {
	process.exit(0);
}

fs.writeFileSync(`${config.output}.ll`, asm.flattern(), 'utf8');




/*------------------------------------------
	Compilation in Clang
------------------------------------------*/
console.info("Compiling...");
if (config.execute && config.source !== false) {
	console.warn("Warn: Compilation flaged as executing result, but result is configured to output a non-executable");
	config.execute = false;
}

if (config.source != "llvm") {
	let args = project.includes
		.concat([
			["-Wno-override-module"],
			["--language=ir", `${config.output}.ll`],
			[`-O${config.optimisation}`]
		])
		.reduce((prev, curr) => prev.concat(curr), []);

	let exec_out = "./" + config.output;
	if (config.source == "asm") {
		args.push('-S');
		exec_out += ".s";
	} else if (os.platform() == "win32") {
		exec_out += ".exe";
	} else if (os.platform() == "darwin") {
		exec_out += ".app";
	} else {
		exec_out += ".out";
	}
	args = args.concat(["-o", exec_out]);

	console.info(`\nclang++ ${args.join(" ")}`);
	let clang = spawnSync('clang++', args, {
		cwd: project.rootPath
	});

	if (clang.status === 0){
		process.stdout.write(clang.output[2]);

		if (config.execute) {
			console.info('\nRunning...');
			let app = spawn(exec_out);
			process.stdin.pipe (process.stdin);
			app.stderr.pipe (process.stderr);
			app.stdout.pipe (process.stdout);

			app.on('close', (code) => {
				if (code === null) {
					console.error(app.signalCode);
					process.exit(1);
				}

				process.exit(code);
			});
		} else {
			process.exit(0);
		}
	} else {
		console.error("FAILED TO COMPILE");
		process.stderr.write(clang.output[2]);
		process.exit(1);
	}
}