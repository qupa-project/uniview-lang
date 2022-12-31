class Instruction {
	constructor(ref) {
		this.ref = ref;
	}

	assign_ID () {
		return;
	}

	flattern(str = "", indent = 0) {
		return " ".repeat(indent)+str;
	}
}
module.exports = Instruction;