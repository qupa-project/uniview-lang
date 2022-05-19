echo off

title "Uniview Dependencie Setup"

set last=%cd%
cd %~dp0

title Uniview Dependencie Setup - Configuring...
cmake -S . -B build --install-prefix="%~dp0\install" -DLLVM_TARGETS_TO_BUILD=X86
title Uniview Dependencie Setup - Building...
cmake --build build
title Uniview Dependencie Setup - Installing...
cmake --build build --target install

cd %last%

echo on