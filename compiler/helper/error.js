function FixStringLength (string, count, filler = " ") {
	return filler.repeat(Math.max(0, count - string.length)) +
		string.slice(0, count);
}

function CodeSection (string, refStart, refEnd) {
	string = string.replace(/\t/g, "  ");

	let offset = refStart.line;
	let digits = refEnd.line.toString().length;

	string = string.split('\n')
		.slice(refStart.line-1, refEnd.line)
		.map((val, i) => [(i+offset).toString(), val]);

	let indent = Math.min(
		...string.map(elm => elm[1].search(/[^ ]/g)),
		refStart.col
	);
	let maxLen = Math.max(...string.map(elm => elm[1].length));

	if (string.length > 5) {
		string = [
			...string
				.slice(0, 2)
				.map(elm => ` ${FixStringLength(elm[0], digits)} │ ${elm[1].slice(indent)}`),
			` ${FixStringLength("*", digits)} │${"·".repeat(maxLen-indent+1)}`,
			...string
				.slice(-2)
				.map(elm => ` ${FixStringLength(elm[0], digits)} │ ${elm[1].slice(indent)}`)
		];
	} else {
		string = string.map(elm => ` ${FixStringLength(elm[0], digits)} │ ${elm[1].slice(indent)}`);
	}

	if (refStart.line == refEnd.line) {
		string.push(
			` ${FixStringLength("*", digits)} │ ` +
			" ".repeat(refStart.col-indent) +
			"^".repeat(refEnd.col-refStart.col)
		);
	}

	return '─'.repeat(digits+2) + "┬" + "─".repeat(maxLen-indent+2) + "\n" +
		string.join('\n') + "\n" +
		'─'.repeat(digits+2) + "┴" + "─".repeat(maxLen-indent+2) +
		`\n  ${refStart.toString()} -> ${refEnd.toString()}`;
}

module.exports = {
	CodeSection
};