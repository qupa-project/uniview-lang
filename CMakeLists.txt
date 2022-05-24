cmake_minimum_required(VERSION 3.13.4)

file(STRINGS "VERSION" UNIVIEW_PROJECT_VERSION)
project(uniview-lang VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(EXECUTABLE_OUTPUT_PATH "${PROJECT_SOURCE_DIR}/build/bin/")

# System information
message("Setup Uniview ${UNIVIEW_PROJECT_VERSION}")
message("-- CMAKE_SYSTEM_INFO_FILE: ${CMAKE_SYSTEM_INFO_FILE}")
message("-- CMAKE_SYSTEM_NAME:      ${CMAKE_SYSTEM_NAME}")
message("-- CMAKE_SYSTEM_PROCESSOR: ${CMAKE_SYSTEM_PROCESSOR}")
message("-- CMAKE_SYSTEM:           ${CMAKE_SYSTEM}")

set(_compiler_arch ${CMAKE_C_COMPILER_ARCHITECTURE_ID})
if("${_compiler_arch}" STREQUAL "")
	set(_compiler_arch ${CMAKE_SYSTEM_PROCESSOR})
endif()

message("Compiler architecture is ${_compiler_arch}")


# list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_DIR}/lib/")


SET(LLVM_DIR "./lib/install/lib/cmake/llvm" CACHE STRING "" FORCE)
# find_package(LLVM REQUIRED CONFIG PATHS "./lib/install/lib/cmake/llvm" "lib/install/lib/cmake/llvm" NO_DEFAULT_PATH)
find_package(LLVM REQUIRED CONFIG)
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")


include_directories(${LLVM_INCLUDE_DIRS})
# separate_arguments(LLVM_DEFINITIONS_LIST NATIVE_COMMAND ${LLVM_DEFINITIONS})
add_definitions(${LLVM_DEFINITIONS_LIST})


#################################################################
# Find the libraries that correspond to the LLVM components
# that we wish to use
#################################################################
llvm_map_components_to_libnames(
	llvm_libs
	Analysis
	BitWriter
	Core
	# Demangle
	ExecutionEngine
	irReader
	MCJIT
	Support
	Target
	Linker
	# aarch64asmparser
	# aarch64codegen
	# aarch64desc
	# aarch64info
	# armasmparser
	# armcodegen
	# armdesc
	# arminfo
	x86asmparser
	x86codegen
	# x86desc
	# x86info
)


# ADD_LIBRARY( Uniview-Core STATIC "src/core/main.c" )

SET( APP_EXE uvc-tools )
# add_executable( ${APP_EXE} main.cpp)
add_executable( ${APP_EXE} "src/uvc-tool/main.c")

# TARGET_LINK_LIBRARIES( Uniview-Core ${llvm_libs} )
# TARGET_LINK_LIBRARIES( ${APP_EXE} Uniview-Core )
TARGET_LINK_LIBRARIES( ${APP_EXE} "${llvm_libs}" )

set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
include(CPack)
