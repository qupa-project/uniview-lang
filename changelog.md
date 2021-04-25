# Change Log

## Upcoming

### Added
- [x] Able to create a clone of any linear value
- [x] Able to parse any linear variable forward to a function call and reasign the modified result
- [x] Added compiler parameter for llvm optimisation sweeps
- [x] Added cloning of linear variables
- [x] Added lending a reference forward to child functions (linear variables only)
- [x] Added borrow checker ensuring child function doesn't corrupt the reference

### Fixes
- [x] Fixed not parsing structures properly on return
- [x] Fixed printing error buffer twice on clang compilation failure
- [x] Fixed crash when using undefined type in template

## v0.0.0

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

# Changes
- [x] Now uses colon notation for types

### Fixes
- [x] Fixed strings requiring pointer types

### Tweaks
- [x] Internal representation of LLVM-IR now allows for latent code branches (sections of code which can be enabled after initial compilation)
- [x] Now executes clang compilation synchonously for cleaner outputs
- [x] Won't execute the output if clang compilation fails