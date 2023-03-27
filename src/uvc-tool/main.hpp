#pragma once

#include <iostream>
#include <stdio.h>
#include <string>
#include <vector>


#include <llvm/ADT/Triple.h>
#include <llvm/Bitcode/BitcodeWriter.h>
#include <llvm/CodeGen/CommandFlags.h>
#include <llvm/CodeGen/TargetPassConfig.h>
#include <llvm/Config/llvm-config.h>
#include <llvm/ExecutionEngine/ExecutionEngine.h>
#include <llvm/ExecutionEngine/GenericValue.h>
// #include <llvm/ExecutionEngine/MCJIT.h>
#include <llvm/ExecutionEngine/SectionMemoryManager.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/IRPrintingPasses.h>
#include <llvm/IR/LegacyPassManager.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Linker/Linker.h>
#include <llvm/MC/TargetRegistry.h>
#include <llvm/Passes/PassBuilder.h>
#include <llvm/Support/CodeGen.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/Support/Host.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Support/SourceMgr.h>
#include <llvm/Support/TargetSelect.h>
#include <llvm/Target/TargetMachine.h>
#include <llvm/Target/TargetOptions.h>
#include <llvm/Transforms/Coroutines/CoroCleanup.h>
#include <llvm/Transforms/Coroutines/CoroConditionalWrapper.h>
#include <llvm/Transforms/Coroutines/CoroEarly.h>
#include <llvm/Transforms/Coroutines/CoroSplit.h>
#include <llvm/Transforms/IPO.h>
#include <llvm/Transforms/IPO/PassManagerBuilder.h>

#include "verbose.hpp"

enum class Exec_Mode {
	Run,
	IR,
	Bitcode,
	Object,
	Verify
};

struct Config {
	Exec_Mode                mode;
	std::vector<std::string> files;
	std::string              output;
	std::string              target;
	bool                 coroutines;
};

Config IngestConfig(int argc, char* argv[]);

llvm::Module* loadAndLinkModules(llvm::LLVMContext& context, const std::vector<std::string>& files);

int Output_Module_Bitcode(llvm::Module* module, const std::string& file_path, bool bitcode);

// void ApplyCoroutine(llvm::LLVMContext& context, llvm::Module& module);

int Execute_Module(llvm::LLVMContext& context, llvm::Module* module);

int Compile_Object(llvm::LLVMContext& ctx, llvm::Module& module, const std::string& output_filename);

int main(int argc, char* argv[]);