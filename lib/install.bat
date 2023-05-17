@echo off

@title "Uniview Dependencie Setup"

@set last=%cd%
@cd %~dp0

@title Configuring - Uniview Dependencies
cmake -S . -B build
@title Building - Uniview Dependencies
cmake --build build
@title Installing - Uniview Dependencies
cmake --build build --target install

@cd %last%
@echo on