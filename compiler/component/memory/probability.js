const LLVM = require('./../../middle/llvm.js');


class Probability {
	/**
	 *
	 * @param {LLVM.Latent} activator The code path to enable on activation
	 * @param {LLVM.Argument} register The value to be taken on after activation
	 * @param {*} segment
	 * @param {*} ref
	 */
	constructor (activator, register, segment, ref) {
		this.activator = activator;
		this.register = register;
		this.segment = segment;
		this.ref = ref;

		this.rel = [];
	}

	isFailure() {
		return this.activator && this.activator.action instanceof LLVM.Failure;
	}

	resolve (ref) {
		// Trigger ties
		for (let act of this.rel) {
			let res = act.activate();
			if (res !== null) {
				res.msg = `Error: Unable to merge possible states at ${ref.start.toString()} due to\n  ${res.msg}`;
				res.ref.end = ref.end;
				return res;
			}
		}

		// Trigger main activation
		if (this.activator) {
			return this.activator.activate();
		}

		return null;
	}

	/**
	 *
	 * @param {Probablity} other
	 */
	link (other) {
		if (other.activator) {
			this.rel.push(other.activator);
		}
	}
}


module.exports = Probability;