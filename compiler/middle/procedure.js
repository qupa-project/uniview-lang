const Fragment = require("./fragment.js");
const LLVM = require('./llvm.js');

class Procedure extends Fragment {
	/**
	 *
	 * @param {LLVM.Type} rtrnType
	 * @param {LLVM.Name} name
	 * @param {LLVM.Argument[]} args
	 * @param {String} attributes
	 * @param {Boolean} external
	 * @param {BNF_Reference?} ref
	 */
	constructor (rtrnType, name, args, attributes, external, ref) {
		super(ref);
		this.rtrnType = rtrnType;
		this.name = name;
		this.args = args;
		this.attributes = attributes;
		this.external = external;
	}

	assign_ID (gen) {
		for (let arg of this.args) {
			arg.assign_ID(gen);
		}

		super.assign_ID(gen);
	}

	flattern () {
		let out = `${this.external ? "declare" : "define"} dso_local ` +
			`${this.rtrnType.flattern()} ` +
			`${this.name.flattern()} ` +
			`(${this.args.map(x => this.external ? x.type.flattern() : x.flattern()).join(', ')}) ` +
			`${this.attributes}`;

		if (this.stmts.length > 0) {
			out += ` {\n` +
				`${this.stmts.map(x => x.flattern(2)).join("\n")}` +
				`\n}`;
		}

		return out;
	}
}

module.exports = Procedure;