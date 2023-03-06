@echo off

@title "Uniview Dependencie Setup"

@set last=%cd%
@cd %~dp0

@title Uniview Dependencie Setup - Configuring...
@rem cmake -S . -B build --install-prefix="%~dp0\install"
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
@title Uniview Dependencie Setup - Building...
cmake --build build
@title Uniview Dependencie Setup - Installing...
cmake --build build --target install

@cd %last%
@echo on