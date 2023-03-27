#include "main.hpp"


Config IngestConfig(int argc, char* argv[]) {
	Config config;
	config.files.clear(); // init
	config.mode = Exec_Mode::Object;
	config.output = "out";
	config.parseCoro = true;

	// Normalize the target triple
	// llvm::Triple triple(llvm::sys::getDefaultTargetTriple());
	// printf("%s, %s, %s\n",
	// 	triple.getArchName().str().c_str(),
	// 	triple.getEnvironmentName().str().c_str(),
	// 	triple.getOSName().str().c_str()
	// );

	// triple.setArch(llvm::Triple::normalizeArch(triple.getArch()));
	// auto TargetTriple = llvm::sys::getDefaultTargetTriple();
	// module.setTargetTriple(TargetTriple);
	// verbose("  target: %s\n", TargetTriple.c_str());

	config.target = llvm::sys::getDefaultTargetTriple();

	// Loop through each argument
	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--version") == 0) {
			printf("Version: %s\n", "v0.0.0");
			printf("  LLVM: %i.%i.%i\n\n", LLVM_VERSION_MAJOR, LLVM_VERSION_MINOR, LLVM_VERSION_PATCH);
			continue;
		}

		if (strcmp(argv[i], "--verbose") == 0) {
			setVerbose(true);
			verbose("Verbose Enabled\n");
			continue;
		}

		if (strcmp(argv[i], "--output") == 0 && i+1 < argc) {
			config.output = argv[i+1];
			i++;
			continue;
		}

		if (strcmp(argv[i], "--target") == 0 && i+1 < argc) {
			config.target = argv[i+1];
			i++;
			continue;
		}

		if (strcmp(argv[i], "--mode") == 0 && i+1 < argc) {
			switch (argv[i+1][0]) {
				case 'r':
					config.mode = Exec_Mode::Run;
					verbose("  Mode: Run\n");
					break;
				case 'i':
					config.mode = Exec_Mode::IR;
					verbose("  Mode: IR\n");
					break;
				case 'b':
					config.mode = Exec_Mode::Bitcode;
					verbose("  Mode: BC\n");
					break;
				case 'v':
					config.mode = Exec_Mode::Verify;
					verbose("  Mode: Verify\n");
					break;
				case 'o':
					config.mode = Exec_Mode::Object;
					verbose("  Mode: Object\n");
					break;
				default:
					printf("Warn: Unknown mode %s\n", argv[i+1]);
			}
			i++;
			continue;
		}

		verbose("  Attached input: %s\n", argv[i]);
		config.files.push_back(argv[i]);
	}

	return config;
}



llvm::Module* loadAndLinkModules(llvm::LLVMContext& context, const std::vector<std::string>& files) {
	llvm::SMDiagnostic error;
	llvm::Module* main_module = nullptr;

	for (const auto& file : files) {
		verbose("Parsing: %s\n", file.c_str());
		std::unique_ptr<llvm::Module> mod = llvm::parseIRFile(file, error, context);
		if (!mod) {
			error.print(/*Prompt=*/"", llvm::outs());
			return nullptr;
		}

		verbose("  - Verifying module\n");
		std::string verifyErrors;
		llvm::raw_string_ostream verifyStream(verifyErrors);
		if (llvm::verifyModule(*mod, &verifyStream)) {
			llvm::errs() << "  Module verification failed: " << verifyStream.str() << "\n";
			return nullptr;
		}

		if (main_module == nullptr) {
			verbose("  - Found main module\n");
			main_module = mod.release();
		} else {
			verbose("  - Linking to main module\n");
			bool err = llvm::Linker::linkModules(*main_module, std::move(mod));
			if (err) {
				llvm::errs() << "  Module linking failed: " << verifyStream.str() << "\n";
				return nullptr;
			}
		}
	}

	return main_module;
}



int Output_Module_Bitcode(llvm::Module* module, const std::string& file_path, bool bitcode) {
	std::error_code ec;
	llvm::raw_fd_ostream output(file_path, ec, llvm::sys::fs::OF_None);

	if (ec) {
		llvm::errs() << "Error opening file: " << ec.message() << "\n";
		return 1;
	}

	if (bitcode) {
		llvm::WriteBitcodeToFile(*module, output);
	} else {
		llvm::legacy::PassManager pm;
		pm.add(llvm::createPrintModulePass(output));
		pm.run(*module);
		output.flush();
	}


	output.flush();
	printf("Wrote: %s", file_path);
	return 0;
}



int Compile_Object(llvm::LLVMContext& ctx, llvm::Module& module, const std::string& output_filename) {
	// Initialize the target registry etc.
	llvm::InitializeAllTargetInfos();
	llvm::InitializeAllTargets();
	llvm::InitializeAllTargetMCs();
	llvm::InitializeAllAsmParsers();
	llvm::InitializeAllAsmPrinters();

	auto TargetTriple = module.getTargetTriple();
	std::string err;
	auto Target = llvm::TargetRegistry::lookupTarget(TargetTriple, err);
	if (!Target) {
		printf("\n\u001b[31merror\u001b[0m: %s\n", err.c_str());

		printf("  Supported Targets:\n");
		auto targets = llvm::TargetRegistry::targets();
		for (auto it = targets.begin(); it != targets.end(); ++it) {
			printf("    - %s\n", it->getName());
		}

		return 1;
	}

	auto CPU = "generic";
	auto Features = "";

	verbose("  - Starting target builder\n");
	llvm::TargetOptions opt;
	auto RM = llvm::Optional<llvm::Reloc::Model>();
	auto TheTargetMachine = Target->createTargetMachine(TargetTriple, CPU, Features, opt, RM);

	module.setDataLayout(TheTargetMachine->createDataLayout());

	std::error_code EC;
	llvm::raw_fd_ostream dest(output_filename.c_str(), EC, llvm::sys::fs::OF_None);
	if (EC) {
		printf("  \u001b[31merror\u001b[0m: Could not open file \"%s\"\n", EC.message().c_str());
		return 1;
	}

	llvm::legacy::PassManager pass;

	auto FileType = llvm::CGFT_ObjectFile;
	if (TheTargetMachine->addPassesToEmitFile(pass, dest, nullptr, FileType)) {
		printf("  \u001b[31merror\u001b[0m: TheTargetMachine can't emit a file of this type\n");
		return 1;
	}

	verbose("  - Verifying module\n");
	llvm::verifyModule(module);

	verbose("  - Running builder\n");
	pass.run(module);

	dest.flush();

	verbose("\n");
	printf("Wrote: %s\n", output_filename.c_str());
	return 0;
}



int Execute_Module(llvm::LLVMContext& context, llvm::Module* module) {
	verbose("Execution:\n");

	// Find the main function in the module
	llvm::Function* mainFunction = module->getFunction("main");
	if (!mainFunction) {
			printf("\n\u001b[31merror\u001b[0m: %s\n", "main function not found in module");
			return 1;
	}

	// Verify the module to check for any errors
	std::string error;
	llvm::raw_string_ostream os(error);
	if (llvm::verifyModule(*module, &os)) {
		printf("\n\u001b[31merror\u001b[0m: %s\n  %s\n", "module verification failed with", error.c_str());
		return 1;
	}

	// printf("\n\u001b[31merror\u001b[0m: %s\n", "Unimplemented");
	// return 1;

	// Create an execution engine for the module
	std::unique_ptr<llvm::Module> modulePtr(module);
	llvm::EngineBuilder builder( std::move(modulePtr) );
	error.clear();
	builder.setErrorStr(&error);
	// builder.setEngineKind(llvm::EngineKind::JIT);
	auto engine = builder.create();
	if (!engine) {
		printf("\n\u001b[31merror\u001b[0m: %s\n  %s\n", "Failed to create execution engine", error.c_str());
		return 1;
	}

	// Execute the main function
	std::vector<llvm::GenericValue> args;
	llvm::GenericValue result = engine->runFunction(mainFunction, args);
	auto code = result.IntVal.getSExtValue();

	printf("\n\nExited: %i\n", code);
	return code;
}



int main(int argc, char* argv[]) {
	Config config = IngestConfig(argc, argv);

	if (getVerbose()) {
		// Set stdout to unbuffered mode
		if (setvbuf(stdout, nullptr, _IONBF, 0) != 0) {
			std::perror("Failed to set stdout to unbuffered mode");
			return 1;
		}
	}

	verbose("Target: %s\n", config.target.c_str());

	verbose("Ingesting LLVM-IR\n");
	llvm::LLVMContext context;
	auto mod = loadAndLinkModules(context, config.files);
	if (!mod) {
		std::cout << "Failed\n";
		return 1;
	}

	mod->setTargetTriple(config.target);

	if (config.parseCoro) {
		// Apply coroutine passes
	}

	switch (config.mode) {
		case Exec_Mode::Verify:
			verbose("Verifying...");
			llvm::verifyModule(*mod);
			break;
		case Exec_Mode::IR:
		verbose("Writing LLVM-IR");
			Output_Module_Bitcode(mod, config.output + ".ll", false);
			break;
		case Exec_Mode::Bitcode:
			verbose("Writing Bitcode");
			Output_Module_Bitcode(mod, config.output + ".bc", true);
			break;
		case Exec_Mode::Run:
			return Execute_Module(context, mod);
		case Exec_Mode::Object:
			verbose("Compiling object:\n");
			Compile_Object(context, *mod, config.output + ".o");
			break;
	}

	verbose("\n");
	return 0;
}