// This should be implemented as a bloom filter in the future
let words = [
	"let",
	"struct", "new",
	"impl", "trait",
	"fn",

	"if", "elif", "else",
	"return",

	"false", "true",

	"Self"
];


/**
 * Checks if a name is a reserved word
 * @param {String} name
 * @returns {Boolean} true means invalid
 */
function Check(name) {
	return words.includes(name);
}


module.exports = {
	Check
};