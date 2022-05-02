@REM mkdir install

cd llvm
mkdir build
cd build

cmake ../llvm
cmake --build .
cmake --build . --target install
