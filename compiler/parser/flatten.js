function AccessToString(node) {
	let str = "";
	let frame = [];

	if (node.type == "data_type") {
		str += node.value[0].flat();
		frame = node.value.slice(1);
	} else {
		frame = node.value;
	}

	str += frame[0].flat();
	str += frame[1].value.map(x => {
		switch (x.type) {
			case "access_static":
				return "." + x.flat();
			case "access_dynamic":
				return `[${x.flat()}]`;
			case "access_template":
				return `#[${ x.value.map(AccessToString).join(", ") }]`;
			default:
				throw new Error(`Unexpected access syntax type ${x.type}`);
		}
	});

	return str;
}


module.exports = {
	AccessToString
}