cmake_minimum_required(VERSION 3.13.4)

file(STRINGS "VERSION" UNIVIEW_PROJECT_VERSION)
project(uniview-lang VERSION ${UNIVIEW_PROJECT_VERSION} LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_program(CLANG_PATH clang++)
set(CMAKE_CXX_COMPILER ${CLANG_PATH})
set(CMAKE_MAKE_PROGRAM "Ninja")
set(CMAKE_GENERATOR "Ninja")
set(CMAKE_LINKER lld)

# System information
message("Setup Uniview ${UNIVIEW_PROJECT_VERSION}")
message("-- CMAKE_CXX_COMPILER:     ${CMAKE_CXX_COMPILER}")
message("-- CMAKE_MAKE_PROGRAM:     ${CMAKE_MAKE_PROGRAM}")
message("-- CMAKE_GENERATOR:        ${CMAKE_GENERATOR}")
message("-- CMAKE_LINKER:           ${CMAKE_LINKER}")
message("-- CMAKE_SYSTEM_INFO_FILE: ${CMAKE_SYSTEM_INFO_FILE}")
message("-- CMAKE_SYSTEM_NAME:      ${CMAKE_SYSTEM_NAME}")
message("-- CMAKE_SYSTEM_PROCESSOR: ${CMAKE_SYSTEM_PROCESSOR}")
message("-- CMAKE_SYSTEM:           ${CMAKE_SYSTEM}")

set(_compiler_arch ${CMAKE_C_COMPILER_ARCHITECTURE_ID})
if("${_compiler_arch}" STREQUAL "")
	set(_compiler_arch ${CMAKE_SYSTEM_PROCESSOR})
endif()

message("Compiler architecture is ${_compiler_arch}")


SET(LLVM_DIR "./lib/install/lib/cmake/llvm" CACHE STRING "" FORCE)
find_package(LLVM REQUIRED CONFIG)
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")


include_directories(${LLVM_INCLUDE_DIRS})
add_definitions(${LLVM_DEFINITIONS_LIST})


#################################################################
# Find the libraries that correspond to the LLVM components
# that we wish to use
#################################################################
llvm_map_components_to_libnames( llvm_libs
	# aarch64asmparser
	# aarch64codegen
	# aarch64desc
	# aarch64info
	Analysis
	# armasmparser
	# armcodegen
	# armdesc
	# arminfo
	BitWriter
	Core
	# Demangle
	ExecutionEngine
	irReader
	Linker
	MCJIT
	Object
	Support
	Target
	x86asmparser
	# x86desc
	x86codegen
	# x86info
)



# set(CMAKE_EXE_LINKER_FLAGS ${CMAKE_EXE_LINKER_FLAGS} -flto)
set(CMAKE_C_COMPILER clang)
SET( TAR )


SET( APP_EXE uvc-tools )
message("Configuring ${APP_EXE}")
add_executable( ${APP_EXE} "src/uvc-tool/main.c"
	"src/uvc-tool/verbose.c"
)
TARGET_LINK_LIBRARIES( ${APP_EXE} "${llvm_libs}" )


SET( LIB uvc-core )
message("Configuring ${LIB}")
ADD_LIBRARY( ${LIB} STATIC
	"src/core/main.c"
)
TARGET_LINK_LIBRARIES( ${LIB} "${llvm_libs}" )


# Add the LLVM library directories
# link_directories(${LLVM_LIBRARY_DIRS})


set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
include(CPack)



add_custom_command(TARGET ${APP_EXE} POST_BUILD
	COMMAND node "${PROJECT_SOURCE_DIR}/tools/env-bind.js" "--uvc_tool=$<TARGET_FILE:${APP_EXE}>"
)
add_custom_command(TARGET ${LIB} POST_BUILD
	COMMAND node "${PROJECT_SOURCE_DIR}/tools/env-bind.js" "--uvc_lib=$<TARGET_FILE:${LIB}>"
)