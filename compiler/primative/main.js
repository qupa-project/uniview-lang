const File = require('./../component/file.js');
const Project = require('../component/project.js');


const Clone = require('./clone.js');
const Either = require('./either.js');
const Static_Cast = require('./static_cast.js');
const Bitcast = require('./bitcast.js');
const Printf = require('./printf.js');
const SizeOf = require('./sizeof.js');
const types = require('./types.js');




/**
 *
 * @param {Project} ctx
 */
function Generate (ctx) {
	let file = new File(ctx, 0, "primative");

	for (let name in types) {
		file.names[name] = types[name];
	}

	file.names.cast = new Static_Cast(file);
	file.names.bitcast = new Bitcast(file);
	file.names.Clone = new Clone(file);
	file.names.sizeof = new SizeOf(file);
	file.names.Either = new Either(file);
	file.names.printf = new Printf(file);

	ctx.inject(file);
}

module.exports = { Generate, types };