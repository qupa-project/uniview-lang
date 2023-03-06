cmake_minimum_required(VERSION 3.11 FATAL_ERROR)

file(STRINGS "../VERSION" UNIVIEW_PROJECT_VERSION)
project(univiewlibs VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C CXX)

find_program(CLANG_PATH clang++)
set(CMAKE_CXX_COMPILER ${CLANG_PATH})
set(CMAKE_MAKE_PROGRAM "Ninja")
set(CMAKE_GENERATOR "Ninja")
set(CMAKE_LINKER lld)

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
message("-- CMAKE_SYSTEM:           ${CMAKE_SYSTEM}")

set(LLVM_DEFAULT_TARGET_TRIPLE "${CMAKE_SYSTEM_PROCESSOR}-${CMAKE_SYSTEM_NAME}-${CMAKE_SYSTEM_VERSION}")
message("Targets Tripple: ${LLVM_DEFAULT_TARGET_TRIPLE}")

set(_compiler_arch ${CMAKE_C_COMPILER_ARCHITECTURE_ID})
if("${_compiler_arch}" STREQUAL "")
	set(_compiler_arch ${CMAKE_SYSTEM_PROCESSOR})
endif()

message("Compiler architecture is ${_compiler_arch}")

set(CMAKE_INSTALL_PREFIX "${PROJECT_SOURCE_DIR}/install" CACHE PATH "Installation directory" FORCE)
message(STATUS "Install path: ${CMAKE_INSTALL_PREFIX}")



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

# set(LLVM_TARGETS_TO_BUILD:STRING "arm64;X86_64;WebAssembly;risv64") future targets

set(LLVM_TARGETS_TO_BUILD "X86;WebAssembly" CACHE STRING "" FORCE)
set(LLVM_ENABLE_PROJECTS "llvm;libc;lld")
set(LLVM_ENABLE_RUNTIMES "libc")

set(LLVM_INSTALL_TOOLCHAIN_ONLY ON)

set(HAVE_CXX_ATOMICS64_WITHOUT_LIB True)
set(HAVE_CXX_ATOMICS_WITHOUT_LIB True)


# set(LLVM_ENABLE_LIBCXX ON)
# set(LIBCXX_ENABLE_STATIC ON)

set(LLVM_ENABLE_LIBC ON)
set(LIBC_ENABLE_STATIC ON)

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

# set(LIBCXX_INCLUDE_BENCHMARKS OFF OFF)
# set(LIBCXX_BUILD_BENCHMARKS OFF OFF)
# set(LIBCXX_INCLUDE_TESTS OFF)
# set(LIBCXX_BUILD_TESTS OFF)
# set(LIBCXX_ENABLE_SPHINX OFF)
# set(LIBCXX_BUILD_DOCS OFF)

set(LIBC_INCLUDE_BENCHMARKS OFF)
set(LIBC_BUILD_BENCHMARKS OFF)
set(LIBC_INCLUDE_TESTS OFF)
set(LIBC_BUILD_TESTS OFF)
set(LIBC_ENABLE_SPHINX OFF)
set(LIBC_BUILD_DOCS OFF)

add_subdirectory("llvm/llvm")
# add_subdirectory("llvm/libc")
# add_subdirectory("llvm/libcxx")
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")