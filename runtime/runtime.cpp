#include <iostream>
#include <ctime>

extern "C" {
	long long NowUTC() {
		time_t u;
		time(&u);
		return static_cast<long long>(u);
	}

	tm DateFrom(long long unixTime) {
		tm out;
		localtime_s (&out, &unixTime);

		return out;
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
}