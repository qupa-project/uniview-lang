function AccessToString(access) {
	return access.map(x => {
		switch (x.type) {
			case "name":
				return x.flat();
			case "access_static":
				return "." + x.flat();
			case "access_dynamic":
				return `[${x.flat()}]`;
			case "access_template":
				return `#[${ x.value.map(AccessToString).join(", ") }]`;
			default:
				throw new Error(`Unexpected access syntax type ${x.type}`);
		}
	}).join("");
}


module.exports = {
	AccessToString
}