const Instruction = require("./instruction.js");

class Fragment extends Instruction {
	constructor (ref = null) {
		super (ref);
		this.stmts = [];
	}

	prepend (instruction) {
		this.stmts = [instruction, ...this.stmts];
	}

	append(instruction) {
		this.stmts.push(instruction);
	}

	merge (other) {
		this.stmts = this.stmts.concat(other.stmts);
	}
	merge_front (other) {
		this.stmts = other.stmts.concat(this.stmts);
	}

	/**
	 * Sweep through instructions and assign IDs linearly
	 * @param {Generator_ID}
	 */
	assign_ID (gen) {
		for (let inst of this.stmts) {
			inst.assign_ID(gen);
		}
	}

	flattern (indent = 0) {
		return this.stmts
			.map(x => x.flattern(indent))
			.filter(x => x.length !== 0)
			.join("\n");
	}
}

module.exports = Fragment;