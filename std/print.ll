define dso_local void @i1_print(i1 %0) {
1:
	br i1 %0, label %2, label %5

2:
	%3 = alloca [5 x i8]
	store [5 x i8] c"True\00", [5 x i8]* %3
	%4 = bitcast [5 x i8]* %3 to i8*
	br label %8

5:
	%6 = alloca [6 x i8]
	store [6 x i8] c"False\00", [6 x i8]* %6
	%7 = bitcast [6 x i8]* %6 to i8*
	br label %8

8:
	%9 = phi i8* [ %4, %2 ], [ %7, %5 ]
	%10 = call i32 (i8*, ...) @printf(i8* %9)

	ret void
}

define dso_local void @i1_println(i1 %0) {
1:
	br i1 %0, label %2, label %5

2:
	%3 = alloca [5 x i8]
	store [5 x i8] c"True\00", [5 x i8]* %3
	%4 = bitcast [5 x i8]* %3 to i8*
	br label %8

5:
	%6 = alloca [6 x i8]
	store [6 x i8] c"False\00", [6 x i8]* %6
	%7 = bitcast [6 x i8]* %6 to i8*
	br label %8

8:
	%9 = phi i8* [ %4, %2 ], [ %7, %5 ]
	call void @puts(i8* %9)

	ret void
}






@i32_print_str = private constant [3 x i8] c"%i\00", align 1
define dso_local void @i32_print(i32 %0) {
1:
	%2 = getelementptr inbounds [3 x i8], [3 x i8]* @i32_print_str, i64 0, i64 0
	%3 = call i32 (i8*, ...) @printf(i8* %2, i32 %0)

	ret void
}
define dso_local void @i32_println(i32 %0) {
1:
	%2 = alloca [4 x i8]
	store [4 x i8] c"%i\0A\00", [4 x i8]* %2
	%3 = bitcast [4 x i8]* %2 to i8*
	%4 = call i32 (i8*, ...) @printf(i8* %3, i32 %0)

	ret void
}





define dso_local void @i64_print(i64 %0) {
1:
	%2 = alloca [3 x i8]
	store [3 x i8] c"%i\00", [3 x i8]* %2
	%3 = bitcast [3 x i8]* %2 to i8*
	%4 = call i32 (i8*, ...) @printf(i8* %3, i64 %0)

	ret void
}
define dso_local void @i64_println(i64 %0) {
1:
	%2 = alloca [4 x i8]
	store [4 x i8] c"%i\0A\00", [4 x i8]* %2
	%3 = bitcast [4 x i8]* %2 to i8*
	%4 = call i32 (i8*, ...) @printf(i8* %3, i64 %0)

	ret void
}



define dso_local void @f64_print(double %0) {
1:
	%2 = alloca [3 x i8]
	store [3 x i8] c"%f\00", [3 x i8]* %2
	%3 = bitcast [3 x i8]* %2 to i8*
	%4 = call i32 (i8*, ...) @printf(i8* %3, double %0)

	ret void
}
define dso_local void @f64_println(double %0) {
1:
	%2 = alloca [4 x i8]
	store [4 x i8] c"%f\0A\00", [4 x i8]* %2
	%3 = bitcast [4 x i8]* %2 to i8*
	%4 = call i32 (i8*, ...) @printf(i8* %3, double %0)

	ret void
}



define dso_local void @str_print(i8* %0) {
1:
	%2 = call i32 (i8*, ...) @printf(i8* %0)

	ret void
}
define dso_local void @str_println(i8* %0) {
1:
	call void @puts(i8* %0)

	ret void
}

declare dso_local i32 @printf(i8*, ...)
declare dso_local void @puts(i8*)