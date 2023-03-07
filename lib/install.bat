@echo off

@title "Uniview Dependencie Setup"

@set last=%cd%
@cd %~dp0

@title Configuring - Uniview Dependencies
@rem cmake -S . -B build --install-prefix="%~dp0\install"
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
@title Building - Uniview Dependencies
cmake --build build
@title Installing - Uniview Dependencies
cmake --build build --target install

@cd %last%
@echo on