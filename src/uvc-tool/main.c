#include "main.h"

int main(int argc, char const *argv[]) {
	enum Compilation_Mode outType = CM_Run;

	char* valid = (char*)malloc(argc);
	valid[0] = 0;

	const char* output = "out.o";

	for (int i=1; i<argc; i++) {
		verbose("loop %i of %i", i, argc);
		if (strcmp(argv[i], "--version") == 0) {
			printf("Version: %s\n", "v0.0.0");
			valid[i] = 0;
			continue;
		}

		if (strcmp(argv[i], "--verbose") == 0) {
			setVerbose(true);
			verbose("Verbose Enabled\n");
			valid[i] = 0;
			continue;
		}

		if (strcmp(argv[i], "--mode") != 1 && i+1 < argc) {
			switch (argv[i+1][0]) {
				case 'r':
					outType = CM_Run;
					break;
				case 'i':
					outType = CM_IR;
					break;
				case 'v':
					outType = CM_Verify;
					break;
				case 'o':
					outType = CM_Obj;
					break;
			}

			valid[i] = 0;
			valid[i+1] = 0;
			i++;
			continue;
		}

		if (strcmp(argv[i], "--output") != 1 && i+1 < argc) {
			output = argv[i+1];
			valid[i] = 0;
			valid[i+1] = 0;
			i++;
			continue;
		}

		valid[i] = 1;
	}

	verbose("Creating Context\n");

	LLVMContextRef ctx = LLVMContextCreate();
	LLVMModuleRef main_mod = NULL;

	for (int i=0; i<argc; i++) {
		if (valid[i] == 0) {
			continue; // skip the current
		}

		// Create Module
		verbose("Creating Module:\n   %s\n", argv[i]);
		char *err = NULL;
		LLVMBool fail;
		LLVMModuleRef mod = LLVMModuleCreateWithNameInContext(argv[i], ctx);


		// Open file
		verbose("  Opening file\n");
		LLVMMemoryBufferRef buf;
		LLVMCreateMemoryBufferWithContentsOfFile(argv[i], &buf, &err);
		if (err) {
			fprintf(stderr, "%s: %s", argv[1], err);
			return 1;
		}

		// Read file
		verbose("  Interpreting\n");
		fail = LLVMParseIRInContext(ctx, buf, &mod, &err);
		if (err) {
			fprintf(stderr, "%s", err);
			return 1;
		}

		// Verify module
		verbose("  Verifying\n");
		fail = LLVMVerifyModule(mod, LLVMAbortProcessAction, &err);
		if (fail) {
			fprintf(stderr, "%s", err);
			return 1;
		}
		LLVMDisposeMessage(err);

		if (i == 1) {
			main_mod = mod;
		} else {
			verbose("  Linking\n");
			LLVMLinkModules2(main_mod, mod);
		}
	}
	free(valid);

	if (main_mod == NULL) {
		fprintf(stderr, "Missing main module argument");
		return 1;
	}

	unsigned long long statusCode = 0;

	switch (outType) {
		case CM_Verify:
			break;
		case CM_IR:
			// Write out bitcode to file
			if (outType == CM_IR && LLVMWriteBitcodeToFile(main_mod, output) != 0) {
				fprintf(stderr, "error writing bitcode to file, skipping\n");
				return 0;
			}
			break;
		case CM_Run:
			return Mode_Execute(ctx, main_mod);
		case CM_Obj:
			return Mode_Object(ctx, main_mod, output);
	}

	LLVMContextDispose(ctx);
	return statusCode;
}



int Mode_Execute(LLVMContextRef ctx, LLVMModuleRef module) {
	LLVMExecutionEngineRef engine;
	LLVMLinkInMCJIT();
	LLVMInitializeNativeTarget();
	LLVMInitializeNativeAsmPrinter();
	LLVMInitializeNativeAsmParser();

	verbose("Starting Execution Engine\n");
	char *err = NULL;
	if (LLVMCreateExecutionEngineForModule(&engine, module, &err) != 0) {
		fprintf(stderr, "failed to create execution engine\n");
		return 1;
	}
	if (err) {
		fprintf(stderr, "error: %s\n", err);
		LLVMDisposeMessage(err);
		return 1;
	}

	verbose("Running\n");

	LLVMValueRef mainFn;
	char * const mainFn_name = "main";
	LLVMBool fail = LLVMFindFunction(engine, mainFn_name, &mainFn);
	if (fail) {
		fprintf(stderr, "Cannot find main function");
		return 1;
	}


	unsigned long long statusCode = 0;
	LLVMGenericValueRef res = LLVMRunFunction(engine, mainFn, 0, NULL);
	statusCode = LLVMGenericValueToInt( res, (LLVMBool)1 );
	LLVMDisposeGenericValue(res);

	verbose("Shutting down execution Engine\n");
	LLVMDisposeExecutionEngine(engine);

	// LLVMDisposeModule(main_mod);
	// should dispose all other modules first?
	LLVMContextDispose(ctx);

	return statusCode;
}


int Mode_Object(LLVMContextRef ctx, LLVMModuleRef module, const char *output_filename) {
	LLVMInitializeX86TargetInfo();
	LLVMInitializeNativeTarget();
	LLVMInitializeX86TargetMC();
	LLVMInitializeNativeAsmParser();
	LLVMInitializeNativeAsmPrinter();

	LLVMTargetRef target = NULL;
	char *error = NULL;
	LLVMGetTargetFromTriple(LLVMGetDefaultTargetTriple(), &target, &error);
	if (error != NULL) {
		fprintf(stderr, "Error: %s\n", error);
		LLVMDisposeMessage(error);
		return 1;
	}

	LLVMCodeGenOptLevel opt_level = LLVMCodeGenLevelAggressive;
	LLVMRelocMode reloc_mode = LLVMRelocStatic;
	LLVMCodeModel code_model = LLVMCodeModelDefault;

	LLVMTargetMachineRef target_machine = LLVMCreateTargetMachine(
		target,
		LLVMGetDefaultTargetTriple(),
		"",
		"",
		opt_level,
		reloc_mode,
		code_model
	);

	// LLVMSetModuleDataLayout(module, LLVMGetModuleDataLayout(data_layout_mod));
	LLVMBool failed = LLVMTargetMachineEmitToFile(
		target_machine,
		module,
		output_filename,
		LLVMObjectFile,
		&error
	);

	if (failed) {
		fprintf(stderr, "Error: %s\n", error);
		LLVMDisposeMessage(error);
		return 1;
	}

	LLVMDisposeTargetMachine(target_machine);
	LLVMContextDispose(ctx);
	return 0;
}