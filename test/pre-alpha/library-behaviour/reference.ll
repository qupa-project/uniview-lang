; ModuleID = 'test\pre-alpha\library-behaviour\main.uv'
; Imported under *:
;   test\pre-alpha\std.uv
;   test\pre-alpha\std.uv

; Function Group "main":
define dso_local i32 @main() #1 {
  %1 = alloca i32, align 4
  %2 = alloca i32, align 4
  %3 = alloca i32, align 4
  store i32 1, i32* %1, align 4
  store i32 2, i32* %2, align 4
  %4 = load i32, i32* %1, align 4
  call void @println.mf1l.15(i32 %4)
  %5 = load i32, i32* %2, align 4
  call void @println.mf1l.15(i32 %5)
  %6 = call i32 @add.mf1l.m(i32 %4,i32 %5)
  store i32 %6, i32* %3, align 4
  call void @println.mf1l.15(i32 %6)
  ret i32 1
}



; ModuleID = 'test\pre-alpha\std.uv'
; Assume Typedef: i32 i32, 4
; Assume Typedef: float float, 4
; Assume Typedef: double double, 4
; Assume Typedef: void void, 0
; Assume Typedef: i1 i1, 4

; Function Group "i32_add":
declare dso_local i32 @i32_add(i32 %0, i32 %1) #1

; Function Group "i32_sub":
declare dso_local i32 @i32_sub(i32 %0, i32 %1) #1

; Function Group "i32_mul":
declare dso_local i32 @i32_mul(i32 %0, i32 %1) #1

; Function Group "i32_div":
declare dso_local i32 @i32_div(i32 %0, i32 %1) #1

; Function Group "i32_rem":
declare dso_local i32 @i32_rem(i32 %0, i32 %1) #1

; Function Group "i32_equal":
declare dso_local i1 @i32_equal(i32 %0, i32 %1) #1

; Function Group "i32_gt":
declare dso_local i1 @i32_gt(i32 %0, i32 %1) #1

; Function Group "i32_ge":
declare dso_local i1 @i32_ge(i32 %0, i32 %1) #1

; Function Group "i32_lt":
declare dso_local i1 @i32_lt(i32 %0, i32 %1) #1

; Function Group "i32_le":
declare dso_local i1 @i32_le(i32 %0, i32 %1) #1

; Function Group "f32_add":
declare dso_local float @f32_add(float %0, float %1) #1

; Function Group "f32_equal":
declare dso_local i1 @f32_equal(float %0, float %1) #1

; Function Group "i1_not":
declare dso_local i1 @i1_not(i1 %0) #1

; Function Group "i1_and":
declare dso_local i1 @i1_and(i1 %0, i1 %1) #1

; Function Group "i1_or":
declare dso_local i1 @i1_or(i1 %0, i1 %1) #1

; Function Group "i1_print":
declare dso_local void @i1_print(i1 %0) #1

; Function Group "i1_println":
declare dso_local void @i1_println(i1 %0) #1

; Function Group "i32_print":
declare dso_local void @i32_print(i32 %0) #1

; Function Group "i32_println":
declare dso_local void @i32_println(i32 %0) #1

; Function Group "f32_print":
declare dso_local void @f32_print(float %0) #1

; Function Group "f32_println":
declare dso_local void @f32_println(float %0) #1



; Function Group "add":
define dso_local i32 @add.mf1l.m(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i32 @i32_add(i32 %0,i32 %1)
  ret i32 %5
}
define dso_local float @add.mf1l.n(float %0, float %1) #1 {
  %3 = alloca float, align 4
  store float %0, float* %3, align 4
  %4 = alloca float, align 4
  store float %1, float* %4, align 4
  %5 = call float @f32_add(float %0,float %1)
  ret float %5
}

; Function Group "sub":
define dso_local i32 @sub.mf1l.o(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i32 @i32_sub(i32 %0,i32 %1)
  ret i32 %5
}

; Function Group "mul":
define dso_local i32 @mul.mf1l.p(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i32 @i32_mul(i32 %0,i32 %1)
  ret i32 %5
}

; Function Group "div":
define dso_local i32 @div.mf1l.q(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i32 @i32_div(i32 %0,i32 %1)
  ret i32 %5
}

; Function Group "rem":
define dso_local i32 @rem.mf1l.r(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i32 @i32_rem(i32 %0,i32 %1)
  ret i32 %5
}

; Function Group "equal":
define dso_local i1 @equal.mf1l.s(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = call i1 @i32_equal(i32 %0,i32 %1)
  ret i1 %5
}
define dso_local i1 @equal.mf1l.t(float %0, float %1) #1 {
  %3 = alloca float, align 4
  store float %0, float* %3, align 4
  %4 = alloca float, align 4
  store float %1, float* %4, align 4
  %5 = call i1 @f32_equal(float %0,float %1)
  ret i1 %5
}

; Function Group "gt":
define dso_local i1 @gt.mf1l.u(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = alloca i1, align 4
  %6 = call i1 @i32_gt(i32 %0,i32 %1)
  store i1 %6, i1* %5, align 4
  ret i1 %6
}

; Function Group "ge":
define dso_local i1 @ge.mf1l.v(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = alloca i1, align 4
  %6 = call i1 @i32_ge(i32 %0,i32 %1)
  store i1 %6, i1* %5, align 4
  ret i1 %6
}

; Function Group "lt":
define dso_local i1 @lt.mf1l.w(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = alloca i1, align 4
  %6 = call i1 @i32_lt(i32 %0,i32 %1)
  store i1 %6, i1* %5, align 4
  ret i1 %6
}

; Function Group "le":
define dso_local i1 @le.mf1l.x(i32 %0, i32 %1) #1 {
  %3 = alloca i32, align 4
  store i32 %0, i32* %3, align 4
  %4 = alloca i32, align 4
  store i32 %1, i32* %4, align 4
  %5 = alloca i1, align 4
  %6 = call i1 @i32_le(i32 %0,i32 %1)
  store i1 %6, i1* %5, align 4
  ret i1 %6
}

; Function Group "and":
define dso_local i1 @and.mf1l.y(i1 %0, i1 %1) #1 {
  %3 = alloca i1, align 4
  store i1 %0, i1* %3, align 4
  %4 = alloca i1, align 4
  store i1 %1, i1* %4, align 4
  %5 = call i1 @i1_and(i1 %0,i1 %1)
  ret i1 %5
}

; Function Group "or":
define dso_local i1 @or.mf1l.z(i1 %0, i1 %1) #1 {
  %3 = alloca i1, align 4
  store i1 %0, i1* %3, align 4
  %4 = alloca i1, align 4
  store i1 %1, i1* %4, align 4
  %5 = call i1 @i1_or(i1 %0,i1 %1)
  ret i1 %5
}

; Function Group "not":
define dso_local i1 @not.mf1l.10(i1 %0) #1 {
  %2 = alloca i1, align 4
  store i1 %0, i1* %2, align 4
  %3 = call i1 @i1_not(i1 %0)
  ret i1 %3
}

; Function Group "xor":
define dso_local i1 @xor.mf1l.11(i1 %0, i1 %1) #1 {
  %3 = alloca i1, align 4
  store i1 %0, i1* %3, align 4
  %4 = alloca i1, align 4
  store i1 %1, i1* %4, align 4
  %5 = alloca i1, align 4
  %6 = call i1 @and.mf1l.y(i1 %0,i1 %1)
  store i1 %6, i1* %5, align 4
  br i1 %6, label %7, label %8

7:
  ret i1 0

8:
  %9 = alloca i1, align 4
  %10 = call i1 @or.mf1l.z(i1 %0,i1 %1)
  store i1 %10, i1* %9, align 4
  br i1 %10, label %11, label %12

11:
  ret i1 1

12:
  ret i1 0
}

; Function Group "print":
define dso_local void @print.mf1l.12(i32 %0) #1 {
  %2 = alloca i32, align 4
  store i32 %0, i32* %2, align 4
  call void @i32_print(i32 %0)
  ret void
}
define dso_local void @print.mf1l.13(float %0) #1 {
  %2 = alloca float, align 4
  store float %0, float* %2, align 4
  call void @f32_print(float %0)
  ret void
}
define dso_local void @print.mf1l.14(i1 %0) #1 {
  %2 = alloca i1, align 4
  store i1 %0, i1* %2, align 4
  call void @i1_print(i1 %0)
  ret void
}

; Function Group "println":
define dso_local void @println.mf1l.15(i32 %0) #1 {
  %2 = alloca i32, align 4
  store i32 %0, i32* %2, align 4
  call void @i32_println(i32 %0)
  ret void
}
define dso_local void @println.mf1l.16(float %0) #1 {
  %2 = alloca float, align 4
  store float %0, float* %2, align 4
  call void @f32_println(float %0)
  ret void
}
define dso_local void @println.mf1l.17(i1 %0) #1 {
  %2 = alloca i1, align 4
  store i1 %0, i1* %2, align 4
  call void @i1_println(i1 %0)
  ret void
}






attributes #0 = { noinline nounwind optnone uwtable "correctly-rounded-divide-sqrt-fp-math"="false" "disable-tail-calls"="false" "frame-pointer"="none" "less-precise-fpmad"="false" "min-legal-vector-width"="0" "no-infs-fp-math"="false" "no-jump-tables"="false" "no-nans-fp-math"="false" "no-signed-zeros-fp-math"="false" "no-trapping-math"="false" "stack-protector-buffer-size"="8" "target-cpu"="x86-64" "target-features"="+cx8,+fxsr,+mmx,+sse,+sse2,+x87" "unsafe-fp-math"="false" "use-soft-float"="false" }