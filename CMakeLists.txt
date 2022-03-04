cmake_minimum_required(VERSION 3.11 FATAL_ERROR)

file(STRINGS "VERSION" PONYC_PROJECT_VERSION)
project(uniview-lang VERSION ${PONYC_PROJECT_VERSION} LANGUAGES C CXX)

# target_link_libraries(LLVM PRIVATE "./lib/llvm/llvm")
#find_package(LLVM REQUIRED CONFIG)


# Uncomment this to show build commands
# set(CMAKE_VERBOSE_MAKEFILE ON)

# We require C++14 (because LLVM does)
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)


# find_package(LLVM REQUIRED CONFIG PATHS "build/libs/lib/cmake/llvm" "build/libs/lib64/cmake/llvm" NO_DEFAULT_PATH)


# LibPonyC tests assume that our outputs are two directories above the root directory.
# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/../debug${PONY_OUTPUT_SUFFIX}")
# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/../release${PONY_OUTPUT_SUFFIX}")
# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${CMAKE_BINARY_DIR}/../minsizerel${PONY_OUTPUT_SUFFIX}")
# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${CMAKE_BINARY_DIR}/../relwithdebinfo${PONY_OUTPUT_SUFFIX}")


#################################################################
# Set gdb
#################################################################
# SET(CMAKE_BUILD_TYPE "Debug")
# SET(CMAKE_CXX_FLAGS_DEBUG "$ENV{CXXFLAGS} -O0 -Wall")
# SET(CMAKE_CXX_FLAGS_RELEASE "$ENV{CXXFLAGS} -O3 -Wall")

# message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
# message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

# add_definitions(${LLVM_DEFINITIONS})

# include_directories(${LLVM_INCLUDE_DIRS})


#################################################################
# Find the libraries that correspond to the LLVM components
# that we wish to use
#################################################################
set(LLVM_LINK_COMPONENTS
	Core
	ExecutionEngine
	Object
	OrcJIT
	Support
	native
)


ADD_LIBRARY( MyStaticLib STATIC structure.c )

SET( APP_EXE StaticTest )

add_executable( ${APP_EXE} main.c)

TARGET_LINK_LIBRARIES( ${APP_EXE} MyStaticLib )

set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
include(CPack)
