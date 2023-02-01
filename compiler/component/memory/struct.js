class StructMem extends Value {
	/**
	 *
	 * @param {TypeRef} type
	 * @param {String} name
	 * @param {BNF_Reference} ref
	 */
	constructor(type, name, ref) {
		super(type, ref);
		this.name = name;
		this.store = null;

		this.isDecomposed = false;
		this.elements = new Map();
	}


	/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	compose (ref){
		if (!this.isDecomposed) {
			return new LLVM.Fragment(ref);
		}

		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		let frag = new LLVM.Fragment();

		for (let elm of this.elements) {
			let res = elm[1].resolve(ref);
			if (res.error) {
				return res;
			}
			frag.merge(res.preamble);

			let access = this.type.type.accessGEPByIndex(elm[0], this.store, ref, false);
			frag.merge(access.preamble);

			let store = res.register;
			let isLinear = elm[1].type.type.typeSystem == "linear";
			if (isLinear) {
				let type = elm[1].type.toLLVM(ref);
				if (!elm[1].type.native) {
					type.offsetPointer(-1);
				}

				let id = new LLVM.ID(ref);
				frag.append(new LLVM.Set(
					new LLVM.Name(id, false, ref),
					new LLVM.Load(
						type,
						store.name,
						ref
					),
					ref
				));

				store = new LLVM.Argument(
					type,
					new LLVM.Name(id.reference(), false, ref),
					ref
				);
			}

			frag.append(new LLVM.Store(
				access.instruction,
				store,
				ref
			));
		}

		this.elements.clear();
		this.isDecomposed = false;
		return frag;
	}

	/**
	 *
	 * @param {LLVM.Fragment|Error} ref
	 */
	decompose (ref){
		// If already decomposed do nothing
		if (this.isDecomposed) {
			return new LLVM.Fragment();
		}

		// Only structures can be decomposed
		if (!(this.type.type.typeSystem == "linear")) {
			return {
				error: true,
				msg: `Cannot decompose none decomposable type ${this.type.type.name}`,
				ref: ref
			};
		}

		// Cannot decompse an undefined value
		if (this.store === null) {
			return {
				error: true,
				msg: "Cannot decompose an undefined value",
				ref: ref
			};
		}

		// Ensure any super positions are resolved before decomposition
		let res = this.resolveProbability(ref);
		if (res !== null) {
			return res;
		}

		// Mark decposed
		this.isDecomposed = true;
		return new LLVM.Fragment();
	}
}


module.exports = StructMem;