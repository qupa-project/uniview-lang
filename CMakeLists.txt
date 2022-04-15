cmake_minimum_required(VERSION 3.13.4)

file(STRINGS "VERSION" UNIVIEW_PROJECT_VERSION)
project(uniview-lang VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES C CXX)


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


# list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_DIR}/lib/")


SET(LLVM_DIR "lib/llvm/llvm/cmake/modules")
find_package(LLVM REQUIRED REQUIRED CONFIG)


# Uncomment this to show build commands
# set(CMAKE_VERBOSE_MAKEFILE ON)


#################################################################
# Set gdb
#################################################################
SET(CMAKE_BUILD_TYPE "Debug")
# SET(CMAKE_CXX_FLAGS_DEBUG "$ENV{CXXFLAGS} -O0 -Wall")
# SET(CMAKE_CXX_FLAGS_RELEASE "$ENV{CXXFLAGS} -O3 -Wall")

message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

include_directories(${LLVM_INCLUDE_DIRS})
separate_arguments(LLVM_DEFINITIONS_LIST NATIVE_COMMAND ${LLVM_DEFINITIONS})
add_definitions(${LLVM_DEFINITIONS_LIST})


#################################################################
# Find the libraries that correspond to the LLVM components
# that we wish to use
#################################################################
llvm_map_components_to_libnames(
	llvm_libs
	support
	core
	irreader
	ADT
)


ADD_LIBRARY( MyStaticLib STATIC structure.c )

SET( APP_EXE StaticTest )

add_executable( ${APP_EXE} main.cpp)

TARGET_LINK_LIBRARIES( ${APP_EXE} MyStaticLib )
TARGET_LINK_LIBRARIES( ${APP_EXE} ${llvm_libs} )

set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
include(CPack)
