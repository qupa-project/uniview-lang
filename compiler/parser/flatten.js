/**
 *
 * @param {SyntaxNode[]} access
 * @returns
 */
function AccessToString(access) {
	return access.value.map(x => {
		switch (x.type) {
			case "data_type_lending?":
			case "name":
				return x.flat();
			case "access_static":
				return "." + x.flat();
			case "access_dynamic":
				return `[${x.flat()}]`;
			case "access_template":
				return `#[${ x.value.map(AccessToString).join(", ") }]`;
			case "(...)*":
				return AccessToString(x);
			default:
				throw new Error(`Unexpected access syntax type ${x.type}`);
		}
	}).join("");
}


module.exports = {
	AccessToString
}