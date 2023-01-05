const Function_Instance = require('./function_instance.js');
const Template = require('../component/template.js');
const Struct = require('../component/struct.js');
const LLVM = require('../middle/llvm.js');

const types = require('./types.js');
const TypeRef = require('../component/typeRef.js');

class Template_Clone extends Template {
	constructor (ctx) {
		super(ctx, null);

		this.children = [];
	}

	findMatch(type) {
		for (let child of this.children) {
			if (child.type.match(type)) {
				return child.function;
			}
		}

		return null;
	}

	getFunction (access, signature) {
		if (signature.length != 1) {
			return false;
		}
		if (signature[0].lent != true && !signature[0].native) {
			return false;
		}

		let type = null;
		if (access.length == 1 && access[0].type == "access_template") {
			if (access[0].value.length != 1) {
				return null;
			}

			type = access[0].value[0];
			type.lent = true;

			if (!type.match(signature[0])) {
				return false;
			}
		} else {
			if (access.length !== 0) {
				return false;
			}

			type = signature[0];
		}

		let cloner = type.type.getCloner();
		if (cloner) {
			return cloner;
		}

		let match = this.findMatch(type);
		if (match) {
			return match;
		}

		let func = this.generate(type);
		if (func) {
			this.children.push({
				type: type,
				function: func
			});

			return func;
		}

		return false;
	}

	generate (type) {
		type.constant = true;
		type.lent = true;

		let out = type.duplicate();
		out.constant = false;
		out.lent = false;

		let func = new Function_Instance(this, "Clone", out, [type]);

		if (type.native) {
			func.isInline = true;
			func.generate = (regs, ir_args) => {
				return {
					preamble: new LLVM.Fragment(),
					instruction: ir_args[0],
					type: type.duplicate()
				};
			};
		} else {
			func.isInline = false;

			if (!(type.type instanceof Struct)) {
				throw new Error("Huh? How...");
			}

			let struct = type.type;
			func.ir.append(new LLVM.Label(new LLVM.ID()).toDefinition());

			let llvmType = new LLVM.Type(
				struct.represent,
				0,
				null
			);

			let cache = new LLVM.ID();
			func.ir.append(new LLVM.Set(
				new LLVM.Name(cache, false, null),
				new LLVM.Load(
					llvmType,
					new LLVM.Name("1", false, null),
					false),
				null
			));

			func.ir.append(new LLVM.Store(
				new LLVM.Argument(
					type.toLLVM(),
					new LLVM.Name("0", false, null),
					null
				),
				new LLVM.Argument(
					llvmType,
					new LLVM.Name(cache.reference(), false, null),
					null
				),
				null
			));

			func.ir.merge(
				RecursiveCopy(
					struct,
					new LLVM.Argument(
						type.toLLVM(),
						new LLVM.Name("1", false, null),
					),
					new LLVM.Argument(
						type.toLLVM(),
						new LLVM.Name("0", false, null),
					)
				)
			);
		}

		func.ir.append(new LLVM.Return(
			new LLVM.Type("void", 0, null)
		));

		func.compile();

		return func;
	}


	toLLVM () {
		return this.children
			.map(x => x.function.toLLVM())
			.reduce((p, c) => {
				p.append(c);
				return p;
			}, new LLVM.Fragment());
	}
}


/**
 *
 * @param {TypeRef} struct
 * @param {LLVM.Argument} from
 * @param {LLVM.Argument} to
 */
function RecursiveCopy(struct, from, to) {
	let frag = new LLVM.Fragment();

	frag.merge(
		struct.terms
			.map((x, i) => {
				let type = x.typeRef.type;
				if (!type.hasNestedCloner()) {
					return null;
				}

				let frag = new LLVM.Fragment();
				let fromArg = struct.accessGEPbyIndex(i, from);
				let toArg = struct.accessGEPbyIndex(i, to);
				frag.merge(fromArg.preamble);
				frag.merge(toArg.preamble);

				let cloner = type.getCloner();
				if (cloner) {
					frag.append(new LLVM.Call(
						new LLVM.Type("void", 0, null),
						new LLVM.Name(cloner.represent, false, null),
						[
							toArg.instruction,
							fromArg.instruction
						],
						null
					));

					return frag;
				}

				frag.merge(RecursiveCopy(
					fromArg.type,
					fromArg.instruction,
					toArg.instruction
				));

				return frag;
			})
			.filter(x => x !== null)
			.reduce((p, c) => {
				if (c instanceof LLVM.Fragment) {
					p.merge(c);
				} else {
					p.append(c);
				}

				return p;
			}, new LLVM.Fragment())
	);

	return frag;
}


module.exports = Template_Clone;