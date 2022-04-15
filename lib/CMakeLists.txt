cmake_minimum_required(VERSION 3.11 FATAL_ERROR)

file(STRINGS "../VERSION" UNIVIEW_PROJECT_VERSION)
project(univiewlibs VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C)

include(ExternalProject)


if(NOT DEFINED UNIVIEW_LIBS_BUILD_TYPE)
	set(UNIVIEW_LIBS_BUILD_TYPE Release)
endif()

# System information
message("-- CMAKE_SYSTEM_INFO_FILE: ${CMAKE_SYSTEM_INFO_FILE}")
message("-- CMAKE_SYSTEM_NAME:      ${CMAKE_SYSTEM_NAME}")
message("-- CMAKE_SYSTEM_PROCESSOR: ${CMAKE_SYSTEM_PROCESSOR}")
message("-- CMAKE_SYSTEM:           ${CMAKE_SYSTEM}")

set(_compiler_arch ${CMAKE_C_COMPILER_ARCHITECTURE_ID})
if("${_compiler_arch}" STREQUAL "")
	set(_compiler_arch ${CMAKE_SYSTEM_PROCESSOR})
endif()

message("Compiler architecture is ${_compiler_arch}")



#################################################################
#  Add LLVM external LIB
#################################################################
# find_package(LLVM REQUIRED CONFIG)

# set(LLVM_TARGETS_TO_BUILD ${_compiler_arch})

message("Building targets: ${LLVM_TARGETS_TO_BUILD}")

set(LLVM_ENABLE_BINDINGS OFF)
set(LLVM_ENABLE_OCAMLDOC OFF)
set(LLVM_ENABLE_PIC OFF)
set(LLVM_ENABLE_TERMINFO OFF)
set(LLVM_ENABLE_WARNINGS OFF)
set(LLVM_ENABLE_Z3_SOLVER OFF)
set(LLVM_INCLUDE_BENCHMARKS OFF)
set(LLVM_INCLUDE_TESTS OFF)
set(LLVM_TOOL_REMARKS_SHLIB_BUILD OFF)
set(LLVM_ENABLE_ZLIB OFF)
set(LLVM_ENABLE_ZLIB:STRING OFF)

set(LLVM_ENABLE_RUNTIMES:STRING ON)

add_subdirectory(llvm/llvm)