define dso_local i8* @offset_ptr(i8* %0, i64 %1) {
2:
	%3 = ptrtoint i8* %0 to i64
	%4 = add i64 %1, %3
	%5 = inttoptr i64 %4 to i8*
  ret i8* %5
}