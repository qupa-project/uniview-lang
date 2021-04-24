const TypeDef = require('../component/typedef.js');

let types = {
	void: new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : 'void'
			},
			{
				type   : "integer",
				tokens : "0"
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true),
	bool: new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : 'i1'
			},
			{
				type   : "integer",
				tokens : "1"
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true),
	float: new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : 'float'
			},
			{
				type   : "integer",
				tokens : "4"
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true),
	double: new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : 'double'
			},
			{
				type   : "integer",
				tokens : "8"
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true),

	string: new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : "i8"
			},
			{
				type   : "integer",
				tokens : "1"
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true)
};


for (let i=1; i<=8; i+=i) {
	let name = `i${i*8}`;
	types[name] = new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : name
			},
			{
				type   : "integer",
				tokens : i.toString()
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true);
	types[name].cat = "int";
	types[name].signed = true;

	u_name = `u${i*8}`;
	types[u_name] = new TypeDef(null, {
		tokens: [
			{
				type   : "name",
				tokens : name
			},
			{
				type   : "integer",
				tokens : i.toString()
			}
		],
		ref: {
			start: null,
			end: null
		}
	}, true);
	types[u_name].name   = u_name;
	types[u_name].cat    = "int";
	types[u_name].signed = false;
}

// Bind float category
types.float.cat  = "float";
types.double.cat = "float";

types.short = types.i16;
types.int   = types.i32;
types.long  = types.i64;
types.uchar  = types.u8;
types.ushort = types.u16;
types.uint   = types.u32;
types.ulong  = types.u64;


// Update primative types correct type system
for (let key in types) {
	types[key].primative = true;
	types[key].typeSystem = 'normal';
}
types.string.typeSystem = "linear";
types.string.primative = true;


module.exports = types;