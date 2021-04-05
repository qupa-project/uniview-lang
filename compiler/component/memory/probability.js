class Probability {
	constructor (activator, register, segment, ref) {
		this.activator = activator;
		this.register = register;
		this.segment = segment;
		this.ref = ref;

		this.rel = [];
	}

	resolve(ref) {
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
	link(other) {
		if (other.activator) {
			this.rel.push(other.activator);
		}
	}
}


module.exports = Probability;