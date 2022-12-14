const LLVM = require('../middle/llvm.js');
const Function_Instance = require('./function_instance.js');
const Structure = require('./struct.js');


class Function {
	constructor (ctx, ast, external = false, abstract = false) {
		this.name = ast.value[0].value[1].value;
		this.ctx = ctx;

		this.ref = ast.ref.start;

		this.represent = this.name + "." + (this.ctx instanceof Structure ?
			this.ctx.represent.slice(1) : this.ctx.represent);

		this.instances = [];
		this.register(ast, external, abstract);
	}

	getFileID () {
		return this.ctx.getFileID();
	}

	getFile () {
		return this.ctx.getFile();
	}

	getFunctionGroup () {
		return this;
	}

	register (ast, external = false, abstract = false) {
		this.instances.push(new Function_Instance( this, ast, external, abstract ));
	}

	registerExport () {
		if (this.instances.length > 1) {
			this.getFile().throw(`Link Error: Cannot export function ${this.name} with more than once instances`, this.ref);
			console.error(this.instances);
		}
		this.instances[0].markExport();
	}

	getFunction (access, signature) {
		if (access.length != 0) {
			return null;
		}

		return this.matchSignature(signature);
	}

	getType(access, stack) {
		return this.ctx.getType(access, stack);
	}

	matchSignature (sig) {
		for (let instance of this.instances) {
			if (instance.abstract && !instance.external) {
				this.getFile().throw(
					`Error: Cannot call abstract function "${this.name}" as it has no implementation`,
					instance.ref,
					instance.ref
				);
			}
			if (instance.matchSignature(sig)) {
				return instance;
			}
		}

		return null;
	}

	ensureEquivalence(other) {
		outer: for (let instA of this.instances) {
			for (let instB of other.instances) {
				if (instA.matchSignature(instB.signature)) {
					continue outer;
				}
			}

			this.ctx.getFile().throw(
				`Error: Unable to find implementation of ${instA.toString()} for trait ${this.ctx.trait.name} in implementation`,
				this.ctx.ref,
				this.ctx.endRef
			);
		}

		outer: for (let instA of other.instances) {
			for (let instB of this.instances) {
				if (instA.matchSignature(instB.signature)) {
					continue outer;
				}
			}

			this.ctx.getFile().throw(
				`Error: Implementation has an extra function instance ${instA.toString()} for trait ${this.ctx.trait.name} in implementation`,
				this.ctx.ref,
				instA.ref
			);
		}
	}

	merge (other){
		this.instances = this.instances.concat( other.instances );
		return true;
	}

	link () {
		for (let instance of this.instances) {
			instance.link();
		}

		// Check name collision
		for (let i=0; i<this.instances.length; i++) {
			for (let j=i+1; j<this.instances.length; j++) {
				if (this.instances[i].matchSignature(this.instances[j].signature) == true) {
					this.getFile().throw(
						`Warn: Multiple definitions of function "${this.name}" (${this.instances[i].signature.map(x => x.toString()).join(", ")})`,
						this.instances[i].ref,
						this.instances[j].ref
					);
				}
			}
		}

		return;
	}

	relink() {
		for (let instance of this.instances) {
			instance.relink();
		}
	}

	compile () {
		for (let instance of this.instances) {
			instance.compile();
		}
	}

	toLLVM() {
		let fragment = new LLVM.Fragment();

		for (let instance of this.instances) {
			let ir = instance.toLLVM();
			fragment.append(ir);
		}

		return fragment;
	}
}


module.exports = Function;