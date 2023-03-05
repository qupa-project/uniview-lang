
#include <stdio.h>

__declspec(dllexport) void fun() {
  printf("fun() called from a static library");
}