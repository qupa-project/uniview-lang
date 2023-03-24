#pragma once
#include <stdbool.h>

int verbose(const char * restrict, ...);

bool getVerbose();
void setVerbose(bool);