const Instruction = require("./instruction.js");

/**
 * Only for use within LLVM.Latent
 */
class Failure extends Instruction {
	/**
	 *
	 * @param {Instruction} type
	 * @param {BNF_Reference?} ref
	 */
	constructor(msg, ref) {
		super (ref);
		this.msg = msg;
	}

	flattern() {
		throw new Error("LLVM.Faliure was not correctly triggered by latent affect");
	}
}

module.exports = Failure;