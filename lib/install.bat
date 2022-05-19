echo off

title "Building Uniview Dependencies"

set last=%cd%
cd %~dp0
cd build

echo "Building CMake scaffold"
cmake ..
echo "Building libraries"
cmake --build .
echo "Installing libraries"
cmake --build . --target install

cd %last%

echo on