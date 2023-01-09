#!/usr/bin/env node
"use strict";

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config();

const Getopt = require('node-getopt');

const Project = require('./component/project.js');

const version = "Uniview Compiler v0.1.0 Alpha";
const root = path.resolve("./");


/*------------------------------------------
	Compiler configuration flags
------------------------------------------*/
const validModes = ["execute", "verify", "preprocess", "uvir", "llir"];
let getopt = new Getopt([
	['m', 'mode=ARG', `compilation mode (${validModes.join("|")})`],
	['', 'opt=ARG', 'optimisation level'],
	['o', 'output=ARG', 'output name'],
	['', 'profile', 'Enable profile timings'],
	['', 'version', 'show version'],
	['', 'verbose', 'verbose logs']
]).bindHelp();
let opt = getopt.parse(process.argv.slice(2));

if (opt.options.version) {
	console.info(version);
	process.exit(0);
}

if (!opt.options.opt) {
	opt.options.opt = "O0";
} else {
	console.warn("Warn: Compilation does not currently support optimisation");
}

if (!opt.options.mode) {
	opt.options.mode = "execute";
} else if (!validModes.includes(opt.options.mode)) {
	console.error(`Invalid compilation mode "${opt.options.mode}"`);
	process.exit(1);
}

if (!opt.options.output) {
	opt.options.output = "out";
}


if (opt.argv.length > 1) {
	console.error("Cannot take multiple uv starting points");
	process.exit(1);
}


let Timers = require('./timers.js');
if (opt.options.profile) {
	Timers.Enable(["read", "link", "compile", "assemble"])
}



/*------------------------------------------
	Compilation to LLVM
------------------------------------------*/
// Load required files
Timers.Checkpoint("read", true);
let origin = path.resolve(root, opt.argv[0]);
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


if (opt.options.mode == "preprocess") {
	console.info("Passed");
	process.exit(0);
}

fs.writeFileSync(`${opt.options.output}.ll`, asm.flattern(), 'utf8');
if (opt.options.mode == "uvir") {
	process.exit(0);
}


/*------------------------------------------
	Compilation in Clang
------------------------------------------*/
console.info("Compiling...");

let tool_mode = "run";
switch (opt.options.mode) {
	case "execute":
		tool_mode = "run";
		break;
	case "verify":
		tool_mode = "verify";
		break;
	case "llir":
		tool_mode = "ir";
		break;
	default:
		console.error(`Invalid option mode ${opt.options.mode} for compilation tools`);
		console.error(`This error shouldn't occur`);
		process.exit(1);
}

let args = [
	`${opt.options.output}.ll`,
	"--mode", tool_mode,
	// "-opt", opt.options.opt
].concat(project.includes);

if (opt.options.verbose) {
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
	console.info(`\nStatus Code: ${code}`);
	Timers.Print();
	process.exit(code);
});
