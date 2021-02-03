const Instruction = require("./instruction.js");

const Failure = require('./failure.js');

class Latent extends Instruction {
	/**
	 *
	 * @param {Instruction} type
	 * @param {BNF_Reference?} ref
	 */
	constructor(action, ref) {
		super (ref);
		this.action = action;
		this.active = false;
	}

	activate() {
		this.active = true;

		if (this.action instanceof Failure) {
			return {
				error: true,
				msg: this.action.msg,
				ref: this.action.ref
			};
		}

		return null;
	}

	assign_ID(gen) {
		if (this.active) {
			this.action.assign_ID(gen);
		}
	}

	flattern(indent) {
		return super.flattern(
			this.active ?
				this.action.flattern() :
				"; Disabled latent action",
		indent);
	}
}

module.exports = Latent;