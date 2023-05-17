const { SyntaxNode } = require("bnf-parser");

function ResolveAccess(node, ctx) {
	let constant = false;
	let lent = false;
	let access = [];

	// Strip out the data_type lent status if present
	switch (node.type) {
		case "data_type":
			if (node.value[0].value == "@") {
				constant = false;
				lent = true;
			} else if (node.value[0].value == "$") {
				constant = true;
				lent = true;
			}

			access = [
				node.value[1],
				...node.value[2].value
			];

			break;
		case "access":
			access = node.value;
			break;
		default:
			throw new Error(`Unexpected syntax node with type "${node.type}"`);
	}

	// Resolve any templates in the access
	access = access.map(x => {
		switch (x.type) {
			case "name":
			case "access_static":
				return x;
			case "access_template":
				return ResolveTemplate_Argument(x, ctx);
			case "access_dynamic":
				this.throw(
					`Error: Dynamic access should not be present in a data type`,
					node.ref.start, node.ref.end
				);
				return null;
			default:
				throw new Error(`Unexpected access type ${x.type}`);
		}
	});

	// If there where any failures
	// Return total failure
	if (access.includes(null)) {
		return null;
	}

	return {
		access,
		constant,
		lent
	};
}

function ResolveTemplate_Argument (node, ctx) {
	let access = node.value.map(arg => {
		switch (arg.type) {
			case "data_type":
				var type = ctx.getType(arg);
				if (type === null) {
					this.throw(
						`Error: Unknown data type ${arg.flat()}`,
						arg.ref.start, arg.ref.end
					);
					return null;
				}

				return type;
			case "constant":
			default:
				this.throw(
					`Error: ${arg.type} are currently unsupported in template arguments`,
					arg.ref.start, arg.ref.end
				);
				return null;
		}
	});

	if (access.includes(null)) {
		return null;
	}

	return new SyntaxNode(
		node.type,
		access,
		node.ref.clone()
	);
}


module.exports = {
	ResolveAccess
};