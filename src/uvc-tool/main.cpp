#include "main.hpp"


Config IngestConfig(int argc, char* argv[]) {
	Config config;
	config.files.clear(); // init
	config.mode = Exec_Mode::Object;
	config.output = "out";

	// Loop through each argument
	for (int i = 1; i < argc; i++) {
		if (strcmp(argv[i], "--version") == 0) {
			printf("Version: %s\n", "v0.0.0");
			continue;
		}

		if (strcmp(argv[i], "--verbose") == 0) {
			setVerbose(true);
			verbose("Verbose Enabled\n");
			continue;
		}

		if (strcmp(argv[i], "--output") != 1 && i+1 < argc) {
			config.output = argv[i+1];
			i++;
			continue;
		}

		if (strcmp(argv[i], "--mode") != 1 && i+1 < argc) {
			switch (argv[i+1][0]) {
				case 'r':
					config.mode = Exec_Mode::Run;
					break;
				case 'i':
					config.mode = Exec_Mode::IR;
					break;
				case 'v':
					config.mode = Exec_Mode::Verify;
					break;
				case 'o':
					config.mode = Exec_Mode::Object;
					break;
			}
			i++;
			continue;
		}

		config.files.push_back(argv[i]);
	}

	return config;
}

llvm::Module* loadAndLinkModules(llvm::LLVMContext& context, const std::vector<std::string>& files) {
	llvm::SMDiagnostic error;
	llvm::Module* main_module = nullptr;

	for (const auto& file : files) {
		verbose("Parsing: %s\n", file.c_str());
		std::unique_ptr<llvm::Module> module = llvm::parseIRFile(file, error, context);
		if (!module) {
			error.print(/*Prompt=*/"", llvm::outs());
			return nullptr;
		}

		verbose("  verifying...\n");
		std::string verifyErrors;
		llvm::raw_string_ostream verifyStream(verifyErrors);
		if (llvm::verifyModule(*module, &verifyStream)) {
			llvm::errs() << "Module verification failed: " << verifyStream.str() << "\n";
			return nullptr;
		}

		if (main_module == nullptr) {
			verbose("  main module\n");
			main_module = module.get();
		} else {
			verbose("  linking...\n");
			bool err = llvm::Linker::linkModules(*main_module, std::move(module));
			if (err) {
				verbose("  failed\n");
				return nullptr;
			}
			verbose("  linked\n");
		}
	}

	verbose(" done\n");
	return main_module;
}


int main(int argc, char* argv[]) {
	verbose("Ingesting config\n");

	Config config = IngestConfig(argc, argv);

	if (getVerbose()) {
		// Set stdout to unbuffered mode
		if (setvbuf(stdout, nullptr, _IONBF, 0) != 0) {
			std::perror("Failed to set stdout to unbuffered mode");
			return 1;
		}
	}

	verbose("Reading files\n");
	llvm::LLVMContext context;
	auto mod = loadAndLinkModules(context, config.files);
	if (!mod) {
		std::cout << "Failed\n";
		return 1;
	}

	std::cout << "Loaded and linked main module.\n";
	return 0;
}