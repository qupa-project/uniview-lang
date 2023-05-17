const Instruction = require("./instruction.js");
const LLVM = require('./llvm.js');


class Call extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} rtrnType
	 * @param {LLVM.Name} name
	 * @param {LLVM.Argument[]} args
	 * @param {BNF_Reference?} ref
	 */
	constructor (rtrnType, name, args, ref) {
		super(ref);
		this.type = rtrnType;
		this.name = name;
		this.args = args;
	}

	flattern (indent) {
		return super.flattern(
			`call ${this.type.flattern()} ` +
			`${this.name.flattern()} ` +
			`(${this.args.map(x=>x.flattern()).join(", ")})`,
		indent);
	}
}

module.exports = Call;