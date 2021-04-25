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
		.map( (val, i) => ` ${FixStringLength((i+offset).toString(), digits)} | ${val}` );

	if (string.length > 5) {
		string = [
			...string.slice(0, 2),
			` ${FixStringLength("*", digits)} | `,
			...string.slice(-2)
		];
	}

	if (refStart.line == refEnd.line) {
		string.push(
			` ${FixStringLength("*", digits)} | ` +
			" ".repeat(refStart.col) +
			"^".repeat(refEnd.col-refStart.col)
		);
	}

	// let highlightA = " ".repeat(digits+2) + "|" +
	// 	" ".repeat(refStart.col) +
	// 	"^".repeat(string[0].length);

	// let highlightB = " ".repeat(digits+2) + "|" +
	// "^".repeat(refEnd.col);

	// return [
	// 	string[0],
	// 	highlightA,
	// 	...string.slice(1),
	// 	highlightB
	// ].join("\n");

	return string.join('\n');
}

module.exports = {
	CodeSection
};