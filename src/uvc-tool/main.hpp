#pragma once

#include <iostream>
#include <stdio.h>
#include <vector>
#include <string>

#include <llvm/IR/LegacyPassManager.h>
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/Verifier.h>
#include <llvm/IRReader/IRReader.h>
#include <llvm/Linker/Linker.h>
#include <llvm/Passes/PassBuilder.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Support/SourceMgr.h>
#include <llvm/Transforms/IPO.h>

#include <vector>
#include <string>
#include <iostream>

#include "verbose.hpp"

enum class Exec_Mode {
	Run,
	IR,
	Object,
	Verify
};

struct Config {
	Exec_Mode                mode;
	std::vector<std::string> files;
	std::string              output;
};


llvm::Module* loadAndLinkModules(llvm::LLVMContext& context, const std::vector<std::string>& files);
Config IngestConfig(int argc, char* argv[]);
int main(int argc, char* argv[]);