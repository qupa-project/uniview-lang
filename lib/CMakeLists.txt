cmake_minimum_required(VERSION 3.11 FATAL_ERROR)

file(STRINGS "../VERSION" UNIVIEW_PROJECT_VERSION)
project(univiewlibs VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C CXX)

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



# Download the submodules if missing
if(GIT_FOUND)
	if(EXISTS "${PROJECT_SOURCE_DIR}/../.git")
		# Update submodules as needed
		option(GIT_SUBMODULE "Check submodules during build" ON)
		if(GIT_SUBMODULE)
			message(STATUS "Updating submodules...")
			execute_process(COMMAND ${GIT_EXECUTABLE} submodule update --init --recursive --depth 1
			      WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
			      RESULT_VARIABLE git_submod_result)
			#message("git_submod_result ${git_submod_result}")
			if(NOT git_submod_result EQUAL "0")
				message(FATAL_ERROR "git submodule update --init --recursive --depth 1 failed with ${git_submod_result}, please checkout submodules")
			endif()

			# we check to make sure the submodule hash matches
			# the reason the submodule hash is in this file is to be able to use this file as a key for caching the libs in CI
			execute_process(COMMAND ${GIT_EXECUTABLE} submodule status
			    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
			    OUTPUT_VARIABLE git_submod_output)
			#message("git_submod_output ${git_submod_output}")
			string(FIND "${git_submod_output}" "${LLVM_DESIRED_HASH}" LLVM_SUBMOD_POS)
			if(LLVM_SUBMOD_POS EQUAL "-1")
				message(FATAL_ERROR "Expecting the lib/llvm/src submodule to be at hash '${LLVM_DESIRED_HASH}'; found '${git_submod_output}'; update the LLVM_DESIRED_HASH variable in lib/CMakeLists.txt if you've updated the submodule.")
			endif()
		endif()
	endif()
endif()



#################################################################
#  Add LLVM external LIB
#################################################################
# find_package(LLVM REQUIRED CONFIG)

set(LLVM_TARGETS_TO_BUILD "ARM;WebAssembly;X86")
# set(LLVM_EXPERIMENTAL_TARGETS_TO_BUILD "x86-64")

message("Building targets: ${LLVM_TARGETS_TO_BUILD}")

set(LLVM_ENABLE_BINDINGS OFF)
set(LLVM_ENABLE_PIC OFF)
set(LLVM_ENABLE_TERMINFO OFF)
set(LLVM_ENABLE_WARNINGS OFF)
set(LLVM_ENABLE_Z3_SOLVER OFF)
set(LLVM_TOOL_REMARKS_SHLIB_BUILD OFF)
set(LLVM_ENABLE_ZLIB OFF)
set(LLVM_ENABLE_ZLIB:STRING OFF)

set(LLVM_ENABLE_RUNTIMES:STRING ON)

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

add_subdirectory(llvm/llvm)