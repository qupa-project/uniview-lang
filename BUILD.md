# Building Uniview from source

## Requirements
* [CMake](https://cmake.org/) >= 3.11
* [Git](https://git-scm.com/) *used by cmake to get required submodules*
* A modern C/++ compiler, preferably Clang 12 or newer
* [Ninja](https://ninja-build.org/)

First of all you need to build the LLVM source components that will be used by Uniview

## Dependency Setup
While in the root directory of the repository run either of these commands.
This will run a series of CMake scripts which will:
1. Pull the require submodules
2. Set the require LLVM build parameters
3. Configure the LLVM build
4. Build the LLVM library
5. Install the LLVM library into the repository

**Windows**
```bash
lib/install.bat
```

**Ubuntu**
```bash
lib/install.bash
```

## Building the Project

Setup the build environment
```bash
npm run build
```