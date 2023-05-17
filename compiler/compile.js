#!/usr/bin/env node
"use strict";

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

require('dotenv').config();
const getopts = require('getopts');

const Project = require('./component/project.js');

const version = "Uniview Compiler v0.1.0 Alpha";
const root = path.resolve("./");


/*------------------------------------------
	Compiler configuration flags
------------------------------------------*/
const validModes = ["execute", "verify", "preprocess", "uvir", "llir"];
let opts = getopts(process.argv.slice(2), {
	default: {
		mode: "execute",
		output: "out",
		version: false,
		profile: false,
		verbose: false,
		optimisation: "O0",
		help: false
	},
	alias: {
		optimisation: ["opt"],
		output: "o"
	},
	boolean: ["version", "profile", "help", "verbose"]
});

if (opts.version) {
	console.info(version);
	process.exit(0);
}

if (!['O1', 'O2', "O3"].includes(opts.optimisation)) {
	console.warn(`Warn: Invalid optimisation level ${opts.optimisation}, assuming O0`);
}

if (!validModes.includes(opts.mode)) {
	console.error(`Invalid compilation mode "${opts.mode}"`);
	process.exit(1);
}


if (opts._.length > 1) {
	console.error("Cannot take multiple uv starting points");
	process.exit(1);
}

if (opts._.length < 1) {
	console.error("Missing entry point");
	process.exit(1);
}


let Timers = require('./timers.js');
if (opts.profile) {
	Timers.Enable(["read", "link", "compile", "assemble"])
}



/*------------------------------------------
	Compilation to LLVM
------------------------------------------*/
// Load required files
Timers.Checkpoint("read", true);
let origin = path.resolve(root, opts._[0]);
let project = new Project(root, {
	caching: false
});
project.import(origin, true);
Timers.Checkpoint("read", false);


// Link elements
console.info("Linking...");
Timers.Checkpoint("link", true);
project.link();
if (project.error) {
	console.error("\nLinker error");
	process.exit(1);
}
Timers.Checkpoint("link", false);


// Compile to LLVM
console.info("Processing...");
Timers.Checkpoint("compile", true);
project.compile();
if (project.error) {
	console.error("\nUncompilable errors");
	process.exit(1);
}
let asm = project.toLLVM();
Timers.Checkpoint("compile", false);


if (opts.mode == "preprocess") {
	console.info("Passed");
	process.exit(0);
}

fs.writeFileSync(`${opts.output}.ll`, asm.flattern(), 'utf8');
if (opts.mode == "uvir") {
	process.exit(0);
}


/*------------------------------------------
	Compilation in Clang
------------------------------------------*/
console.info("Compiling...");

let needsLinking = project.includes
	.filter(x => ["object", "static"].includes(x.type)).length > 0;

let tool_mode = "execute";
switch (opts.mode) {
	case "execute":
		tool_mode = "run";
		break;
	case "compile":
		needsLinking = true;
		tool_mode = "object";
		break;
	case "verify":
		tool_mode = "verify";
		break;
	case "llir":
		tool_mode = "ir";
		break;
	default:
		console.error(`Invalid option mode ${opts.mode} for compilation tools`);
		console.error(`This error shouldn't occur`);
		process.exit(1);
}


let args = [
	`${opts.output}.ll`,
	"--mode", needsLinking ? "o" : tool_mode,
	"--output", opts.output
].concat(project.includes
	.filter(x => x.type=="llvm")
	.map(x => x.path)
);

if (opts.verbose) {
	args.push("--verbose");
}


let tool_path = process.env.uvc_tool;
if (!fs.existsSync(tool_path)) {
	console.error(`Cannot find tool: ${tool_path}`);
	process.exit(1);
}


console.info(`\n${tool_path} ${args.join(" ")}\n`);
Timers.Checkpoint("assemble", true);
let tool = spawn(tool_path, args, {
	cwd: project.rootPath
});

tool.stdout.pipe(process.stdout);
tool.stderr.pipe(process.stderr);

tool.on('close', (code) => {
	Timers.Checkpoint("assemble", false);

	if (needsLinking) {
		Link();
		return;
	}

	console.info(`\nStatus Code: ${code}`);
	Timers.Print();
	process.exit(code);
});



function Link() {
	Timers.Checkpoint("linking", true);

	let targets = project.includes
		.filter(x => x.type!="llvm")
		.map(x => x.path);

	console.info(`\nlld-link ${opts.output}.o ${targets.join(" ")}\n`);
	let linker = spawn("lld-link", [
		opts.output+".o",
		...targets,
		`/OUT:${opts.output}.exe`
	], {
		cwd: project.rootPath
	});

	linker.stdout.pipe(process.stdout);
	linker.stderr.pipe(process.stderr);

	linker.on('close', (code) => {
		Timers.Checkpoint("linking", false);

		if (opts.mode == "execute") {
			Execution();
			return;
		}

		console.info(`\nStatus Code: ${code}`);
		Timers.Print();
		process.exit(code);
	});
}


function Execution() {
	Timers.Checkpoint("execution", true);
	console.info(`\n${opts.output}.exe\n`);
	let exec = spawn(`${opts.output}.exe`, [], {
		cwd: project.rootPath
	});

	exec.stdout.pipe(process.stdout);
	exec.stderr.pipe(process.stderr);

	exec.on('close', (code) => {
		Timers.Checkpoint("execution", false);
		console.info(`\nStatus Code: ${code}`);
		Timers.Print();
		process.exit(code);
	});
}