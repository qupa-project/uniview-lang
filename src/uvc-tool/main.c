#include <llvm-c/Core.h>
#include <llvm-c/ExecutionEngine.h>
#include <llvm-c/Target.h>
#include <llvm-c/Analysis.h>
#include <llvm-c/IRReader.h>
#include <llvm-c/BitWriter.h>
#include <llvm-c/Linker.h>

#include <stdio.h>
#include <string.h>

enum Compilation_Mode {
	CM_Run,
	CM_IR,
	CM_Verify
};

int main(int argc, char const *argv[]) {
	enum Compilation_Mode outType = CM_Run;

	for (int i=1; i<argc; i++) {
		if (strcmp(argv[i], "--version") == 0) {
			printf("Version: %s\n", "v0.0.0");
			return 0;
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
			}
		}
	}

	LLVMContextRef ctx = LLVMContextCreate();
	LLVMModuleRef main_mod = NULL;

	for (int i=1; i<argc; i++) {
		if (argv[i][0] == ("-")[0]) {
			i++;      // skip the next
			continue; // skip the current
		}

		// Create Module
		char *err = NULL;
		LLVMBool fail;
		LLVMModuleRef mod = LLVMModuleCreateWithNameInContext(argv[i], ctx);

		// Open file
		LLVMMemoryBufferRef buf;
		LLVMCreateMemoryBufferWithContentsOfFile(argv[i], &buf, &err);
		if (err) {
			fprintf(stderr, "%s: %s", argv[1], err);
			return 1;
		}

		// Read file
		fail = LLVMParseIRInContext(ctx, buf, &mod, &err);
		if (err) {
			fprintf(stderr, err);
			return 1;
		}

		// Verify module
		fail = LLVMVerifyModule(mod, LLVMAbortProcessAction, &err);
		if (fail) {
			fprintf(stderr, err);
			return 1;
		}
		LLVMDisposeMessage(err);

		if (i == 1) {
			main_mod = mod;
		} else {
			LLVMLinkModules2(main_mod, mod);
		}
	}

	if (main_mod == NULL) {
		fprintf(stderr, "Missing main module argument");
		return 1;
	}



	char *err = NULL;
	LLVMExecutionEngineRef engine;
	LLVMLinkInMCJIT();
	LLVMInitializeNativeTarget();
	LLVMInitializeNativeAsmPrinter();
	LLVMInitializeNativeAsmParser();
	if (LLVMCreateExecutionEngineForModule(&engine, main_mod, &err) != 0) {
		fprintf(stderr, "failed to create execution engine\n");
		return 1;
	}
	if (err) {
		fprintf(stderr, "error: %s\n", err);
		LLVMDisposeMessage(err);
		return 1;
	}

	unsigned long long statusCode = 0;

	switch (outType) {
		case CM_Verify:
			break;
		case CM_IR:
			// Write out bitcode to file
			if (outType == CM_IR && LLVMWriteBitcodeToFile(main_mod, "out.bc") != 0) {
				fprintf(stderr, "error writing bitcode to file, skipping\n");
				return 0;
			}
			break;
		case CM_Run:
			puts("Running...");

			LLVMValueRef mainFn;
			char * const mainFn_name = "main";
			LLVMBool fail = LLVMFindFunction(engine, mainFn_name, &mainFn);
			if (fail) {
				fprintf(stderr, "Cannot find main function");
				return 1;
			}

			LLVMGenericValueRef res = LLVMRunFunction(engine, mainFn, 0, NULL);
			statusCode = LLVMGenericValueToInt( res, (LLVMBool)1 );
			LLVMDisposeGenericValue(res);
			break;
	}


	LLVMDisposeExecutionEngine(engine);
	// LLVMDisposeModule(main_mod);
	// should dispose all other modules first?
	LLVMContextDispose(ctx);

	return statusCode;
}