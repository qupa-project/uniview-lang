function* IDGenerator (seed) {
	let state = seed;
	while (true) {
		yield state++;
	}
}

class Generator_ID {
	constructor (seed = 0) {
		this.internal = IDGenerator(seed);
	}

	next () {
		return this.internal.next().value;
	}
}

module.exports = {
	Generator_ID
};