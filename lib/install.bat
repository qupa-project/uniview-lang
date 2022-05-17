@REM mkdir install

cd llvm
mkdir build
cd build

@REM cmake ../llvm -DLLVM_ENABLE_ASSERTIONS=ON
cmake ../llvm
cmake --build .
cmake --build . --target install
