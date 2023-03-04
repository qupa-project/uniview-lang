# Compilation

## Windows

### With Visual Studio

```bash
winget install Kitware.CMake
winget install LLVM.LLVM
Microsoft.VisualStudio.2022.Community
```

### Without Visual Studio

```bash
winget install Kitware.CMake
winget install LLVM.LLVM
winget install Ninja-build.Ninja
winget install Microsoft.VisualStudio.2022.BuildTools
```

Install required MS build tool components:
  * Required component `Desktop Development with C++`