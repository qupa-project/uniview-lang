const Instruction = require("./instruction.js");

class Phi extends Instruction {
	/**
	 *
	 * @param {LLVM.Type} type
	 * @param {LLVM.Name|LLVM.Constant[][]} opts
	 */
	constructor(type, opts, ref) {
		super (ref);
		this.type = type;
		this.opts = opts;
	}

	assign_ID(gen) {
		for (let opt of this.opts) {
			opt[0].assign_ID(gen),
			opt[1].assign_ID(gen);
		}
	}

	flattern(indent) {
		return super.flattern(
			`phi ${this.type.flattern()} ` +
				this.opts.map(
					x => `[ ${x[0].flattern()}, ${x[1].flattern()} ]`
				).join(', '),
		indent);
	}
}
module.exports = Phi;