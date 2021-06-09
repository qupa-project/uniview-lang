#include <iostream>
#include <time.h>

extern "C" {
	// Too much of a headache and segfaults in unix
	// tm gmtime_safe(const time_t time) {
	// 	tm tm_snapshot;
	// 	#if (defined(WIN32) || defined(_WIN32) || defined(__WIN32__))
	// 		gmtime_s(&tm_snapshot, &time);
	// 	#else
	// 		gmtime_r(&time, &tm_snapshot); // POSIX
	// 	#endif

	// 	return tm_snapshot;
	// }

	// tm localtime_safe(const time_t time)	{
	// 	tm tm_snapshot;
	// 	#if (defined(WIN32) || defined(_WIN32) || defined(__WIN32__))
	// 		localtime_s(&tm_snapshot, &time);
	// 	#else
	// 		localtime_r(&time, &tm_snapshot); // POSIX
	// 	#endif

	// 	return tm_snapshot;
	// }

	char* Offset(char* ptr, long amount) {
		return ptr + amount;
	}

	void i32_print(int val) {
		std::cout << val;
	}
	void i64_print(long long int val) {
		std::cout << val;
	}
	void f32_print(float val) {
		std::cout << val;
	}
	void f64_print(double val) {
		std::cout << val;
	}
	void i1_print(bool val) {
		if (val) {
			std::cout << "true";
		} else {
			std::cout << "false";
		}
	}
	void str_print(char* val) {
		std::cout << val;
	}
	void blob_print(char* val) {
		std::cout << val;
	}

	void i32_println(int val) {
		std::cout << val << std::endl;
	}
	void i64_println(long long int val) {
		std::cout << val << std::endl;
	}
	void f32_println(float val) {
		std::cout << val << std::endl;
	}
	void f64_println(double val) {
		std::cout << val << std::endl;
	}
	void i1_println(bool val) {
		if (val) {
			std::cout << "true" << std::endl;
		} else {
			std::cout << "false" << std::endl;
		}
	}
	void str_println(char* val) {
		std::cout << val << std::endl;
	}
	void blob_println(char* val) {
		std::cout << val << std::endl;
	}
}