; ModuleID = 'primative'
; Assume Typedef: void void, 0
; Assume Typedef: i1 i1, 1
; Assume Typedef: float float, 4
; Assume Typedef: double double, 8
; Assume Typedef: i8 i8, 1
; Assume Typedef: u8 i8, 1
; Assume Typedef: i16 i16, 2
; Assume Typedef: u16 i16, 2
; Assume Typedef: i32 i32, 4
; Assume Typedef: u32 i32, 4
; Assume Typedef: i64 i64, 8
; Assume Typedef: u64 i64, 8
; Assume Typedef: i8 i8, 1
; Assume Typedef: i16 i16, 2
; Assume Typedef: i32 i32, 4
; Assume Typedef: i64 i64, 8
; Assume Typedef: u8 i8, 1
; Assume Typedef: u16 i16, 2
; Assume Typedef: u32 i32, 4
; Assume Typedef: u64 i64, 8






; ModuleID = 'test.uv'
; Imported under *:
;   primative

; Function Group "main":
define dso_local i32 @main () #1 {
0:
  ret i32 4
}






attributes #0 = { noinline nounwind optnone uwtable "correctly-rounded-divide-sqrt-fp-math"="false" "disable-tail-calls"="false" "frame-pointer"="none" "less-precise-fpmad"="false" "min-legal-vector-width"="0" "no-infs-fp-math"="false" "no-jump-tables"="false" "no-nans-fp-math"="false" "no-signed-zeros-fp-math"="false" "no-trapping-math"="false" "stack-protector-buffer-size"="8" "target-cpu"="x86-64" "target-features"="+cx8,+fxsr,+mmx,+sse,+sse2,+x87" "unsafe-fp-math"="false" "use-soft-float"="false" }