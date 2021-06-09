define dso_local i64 @qupa.cstring.size (i8* %str) {
	begin:
		br label %loop

	loop:
		%len = phi i64 [ 0, %begin ], [ %nx, %check ]
		br label %check

	check:
		%nx = add i64 %len, 1
		%ptr = getelementptr i8, i8* %str, i64 %nx
		%i = load i8, i8* %ptr
		%bool = icmp ne i8 %i, 0
		br i1 %bool, label %loop, label %end

	end:
		%0 = add i64 %nx, 1
		ret i64 %0
}