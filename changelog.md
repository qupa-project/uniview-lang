# Change Log

## Upcoming

### Added
- [x] Ability to lend primative values
- [x] Can now use external structures within uniview code

### Fixes
- [x] Fixed being unable to use structure access chaining ``a.b.c``
- [x] Fixed unix segfault not being picked up as a failed execution

### Tweaks
- [x] Primitive numbers are 64bit by default.
- [x] Compiler now generates all IR in fragments before joining (will assist with template implementation).
- [x] Changed ``sizeof`` function to being a compiled default non-inlined function.
- [x] Changed primitive function name ``static_cast`` to ``cast``.
- [x] Probabilities are now used to represent loading structure values (GEPs) to remove irrelevant code and clean up the compiler code base.

## Version 0.0.1

### Added
- [x] Able to create a clone of any linear value
- [x] Able to parse any linear variable forward to a function call and reasign the modified result
- [x] Compiler parameter for llvm optimisation sweeps
- [x] Cloning of linear variables
- [x] Lending a reference forward to child functions (linear variables only)
- [x] Borrow checker ensuring child function doesn't corrupt the reference
- [x] Ability to include external files to the LLVM build pass
- [x] Ability to assume more complex external filenames
- [x] Basic math library
- [x] f64 printing
- [x] Verify only compilation mode
- [x] Expression chaining `(1 + 2 + 3)`
- [x] Opperator Precedence
- [x] Experimental Time Library

### Fixes
- [x] Not parsing structures properly on return
- [x] Printing error buffer twice on clang compilation failure
- [x] Crash when using undefined type in template
- [x] Returning within if-statement causing that branch's instructions to not be saved
- [x] Composing structures with structure elements
- [x] Frash during scope cleanup due to bad code reference
- [x] Using undefined variables within expressions causing crash
- [x] Fixed crash with unhandled call return values
- [x] Crash when structures are defined after accessing attribute within IR

### Tweaks
- [x] Decomposed structure elements now have the correct internal names for error messages
- [x] Compile errors now use path relative to root file (shorter printing)


---
## Version 0.0.0
---

### Added
- [x] Assign and return numbers
- [x] Use primitive variable inputs
- [x] Basic operands with primitive types
- [x] Primitive types using non-linear type system for easier use
- [x] Basic automatic test suite
- [x] Typecasting of primitive types
- [x] Implemented if statements
- [x] Clearer Error logs. Embeds code snippet with line ref
- [x] Strucutre manipulation support
- [x] Declaration type can be derived from assignment

### Changes
- [x] Now uses colon notation for types

### Fixes
- [x] Fixed strings requiring pointer types

### Tweaks
- [x] Internal representation of LLVM-IR now allows for latent code branches (sections of code which can be enabled after initial compilation)
- [x] Now executes clang compilation synchonously for cleaner outputs
- [x] Won't execute the output if clang compilation fails