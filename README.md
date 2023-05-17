# Uniview-lang

> View once immutability enabling the safeties of immutable code, while enjoying near procedural performance

The core goal of this language is to implement compile time determined memory managed applications without developers needing to consider memory management. No pointers, no life times, just code.

When any non-primative value is viewed it can no longer be used, this extends to structure attributes. However there is no concept of null or undefined being a value. Undefined is a compile time state and that's it.
```uv
fn main(): int {
	let person = Blank#[Person]();
	print(person.name); // name has now been consumed
	consume(person); // error cannot compose person due to undefined name
}
```

You can also find a few examples in `test/pre-alpha/`.


## Compiler Arguments

| Argument | Use |
| :- | :- |
| `-o {filename}` | The destination file name for the LLVM IR and binary output |
| `-mode {mode}` | The processing to perform (`parse`, `verify`, `uvir`, `llir`, `object`, `execute`) |
| `--opt O{num}` | Runs optimisation passes over the output (any number between 0-3 inclusive) |
| `--version` | Prints the version of the compiler |
| `--profile` | Enable compilation profiling |
| `--verbose` | Use verbose build logs |
