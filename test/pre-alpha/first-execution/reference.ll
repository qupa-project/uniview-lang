; Function Group "i32_println":
declare dso_local void @i32_println(i32 %0) #1

; Function Group "main":
define dso_local i32 @main() #1 {
  %1 = alloca i32, align 4
  %2 = alloca i32, align 4
  %3 = alloca i32, align 4
  store i32 1, i32* %1, align 4
  store i32 2, i32* %2, align 4
  %4 = load i32, i32* %1, align 4
  call void @i32_println(i32 %4)
  %5 = load i32, i32* %2, align 4
  call void @i32_println(i32 %5)
  %6 = add i32 %4, %5
  call void @i32_println(i32 %6)
  call void @i32_println(i32 %5)
  ret i32 1
}
