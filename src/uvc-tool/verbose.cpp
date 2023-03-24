#include <stdbool.h>
#include <stdarg.h>
#include <stdio.h>

#include "verbose.h"

bool isVerbose = false;

void setVerbose(bool setting) {
		isVerbose = setting;
}

int verbose(const char* format, ...) {
	if (!isVerbose) {
		return 0;
	}

	va_list args;
	va_start(args, format);
	int ret = vprintf(format, args);
	va_end(args);

	return ret;
}

bool getVerbose() {
	return isVerbose;
}