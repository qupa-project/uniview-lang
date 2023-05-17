cmake_minimum_required(VERSION 3.11 FATAL_ERROR)

file(STRINGS "../VERSION" UNIVIEW_PROJECT_VERSION)
project(univiewlibs VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C CXX)

find_program(CLANG_PATH clang++)
set(CMAKE_CXX_COMPILER ${CLANG_PATH})
set(CMAKE_MAKE_PROGRAM "Ninja")
set(CMAKE_GENERATOR "Ninja")
set(CMAKE_LINKER lld)

set(CMAKE_BUILD_TYPE "Release")

include(ExternalProject)


# if(NOT DEFINED UNIVIEW_LIBS_BUILD_TYPE)
# 	set(UNIVIEW_LIBS_BUILD_TYPE Debug)
# endif()

# System information
message("Setup Uniview Libs ${UNIVIEW_PROJECT_VERSION}")
message("-- CMAKE_CXX_COMPILER:     ${CMAKE_CXX_COMPILER}")
message("-- CMAKE_MAKE_PROGRAM:     ${CMAKE_MAKE_PROGRAM}")
message("-- CMAKE_GENERATOR:        ${CMAKE_GENERATOR}")
message("-- CMAKE_LINKER:           ${CMAKE_LINKER}")
message("-- CMAKE_SYSTEM_INFO_FILE: ${CMAKE_SYSTEM_INFO_FILE}")
message("-- CMAKE_SYSTEM_NAME:      ${CMAKE_SYSTEM_NAME}")
message("-- CMAKE_SYSTEM_PROCESSOR: ${CMAKE_SYSTEM_PROCESSOR}")
message("-- CMAKE_BUILD_TYPE:       ${CMAKE_BUILD_TYPE}")
message("-- CMAKE_SYSTEM:           ${CMAKE_SYSTEM}")

# LLVM does a better job of this, CMake's processor value is not valid for LLVM
# set(LLVM_DEFAULT_TARGET_TRIPLE "${CMAKE_SYSTEM_PROCESSOR}-${CMAKE_SYSTEM_NAME}-${CMAKE_SYSTEM_VERSION}")

set(_compiler_arch ${CMAKE_C_COMPILER_ARCHITECTURE_ID})
if("${_compiler_arch}" STREQUAL "")
	set(_compiler_arch ${CMAKE_SYSTEM_PROCESSOR})
endif()

message("Compiler architecture is ${_compiler_arch}")

set(CMAKE_INSTALL_PREFIX "${PROJECT_SOURCE_DIR}/install" CACHE PATH "Installation directory" FORCE)
message(STATUS "Install path: ${CMAKE_INSTALL_PREFIX}")

set(CMAKE_BUILD_TYPE Release CACHE STRING "Set the build type")



# Download the submodules if missing
find_package(Git)
if(GIT_FOUND)
	if(EXISTS "${PROJECT_SOURCE_DIR}/../.git")
		# Update submodules as needed
		option(GIT_SUBMODULE "Check submodules during build" ON)
		if(GIT_SUBMODULE)
			message(STATUS "Updating submodules...")
			execute_process(COMMAND ${GIT_EXECUTABLE} submodule update --init --recursive --depth 1
			  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
			  RESULT_VARIABLE git_submod_result)
			if(NOT git_submod_result EQUAL "0")
				message(FATAL_ERROR "git submodule update --init --recursive --depth 1 failed with ${git_submod_result}, please checkout submodules")
			endif()
		endif()
	endif()
endif()



#################################################################
#  Add LLVM external LIB
#################################################################
# find_package(LLVM REQUIRED CONFIG)

set(LLVM_TARGETS_TO_BUILD "ARM;RISCV;X86;")
set(LLVM_ENABLE_PROJECTS "llvm;lld")
set(LLVM_BUILD_JIT ON)


set(LLVM_ENABLE_COROUTINES ON)
set(LLVM_ENABLE_LLD_CPP ON)
set(LLVM_ENABLE_CXX_BINDINGS OFF)
# set(LLVM_ENABLE_LIBCXX OFF)
# set(LLVM_ENABLE_C_BINDINGS OFF)
# set(LLVM_ENABLE_LIBC OFF)
# set(LIBCXX_ENABLE_STATIC OFF)
# set(LIBC_ENABLE_STATIC OFF)


set(HAVE_CXX_ATOMICS64_WITHOUT_LIB True)
set(HAVE_CXX_ATOMICS_WITHOUT_LIB True)

set(LLVM_ENABLE_Z3_SOLVER OFF)
set(LLVM_ENABLE_ZLIB OFF)
set(LLVM_ENABLE_ZLIB:STRING OFF)

# Disable examples/benchmarks/docs
set(LLVM_INCLUDE_EXAMPLES OFF)
set(LLVM_BUILD_EXAMPLES OFF)
set(LLVM_INCLUDE_BENCHMARKS OFF)
set(LLVM_BUILD_BENCHMARKS OFF)
set(LLVM_INCLUDE_TESTS OFF)
set(LLVM_BUILD_TESTS OFF)
set(LLVM_INCLUDE_TOOLS OFF)
set(LLVM_BUILD_TOOLS OFF)
set(LLVM_ENABLE_OCAMLDOC OFF)
set(LLVM_BUILD_DOCS OFF)
set(LLVM_ENABLE_DOXYGEN OFF)
set(LLVM_ENABLE_SPHINX OFF)

add_subdirectory("llvm/llvm")
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Building for ${LLVM_TARGETS_TO_BUILD}")