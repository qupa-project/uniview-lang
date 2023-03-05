#pragma once

#include <llvm-c/Core.h>
#include <llvm-c/ExecutionEngine.h>
#include <llvm-c/Analysis.h>
#include <llvm-c/IRReader.h>
#include <llvm-c/BitWriter.h>
#include <llvm-c/Linker.h>

#include <llvm-c/TargetMachine.h>
#include <llvm-c/Target.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "verbose.h"


enum Compilation_Mode {
	CM_Run,
	CM_IR,
	CM_Obj,
	CM_Verify
};

int main(int argc, char const *argv[]);



int Mode_Execute(LLVMContextRef ctx, LLVMModuleRef module);


int Mode_Object(LLVMContextRef ctx, LLVMModuleRef module, const char *output_filename);