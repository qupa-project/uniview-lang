let enabled = false;
let timers = {};


function Enable(names) {
	for (let name of names) {
		timers[name] = {
			start: 0,
			tally: 0
		};
	}

	enabled = true;
}

function Checkpoint(name, start) {
	if (!enabled) {
		return;
	}

	if (start) {
		timers[name].start = Date.now();
	} else {
		let end = Date.now();
		timers[name].tally += end - timers[name].start;
	}
}

function Print() {
	if (!enabled) {
		return;
	}

	console.log(
		"Timers: \n" +
		Object.keys(timers).map(key => `  - ${key}: ${timers[key].tally}`).join("\n") +
		`\nTotal: ${
			Object.keys(timers)
				.map(key => timers[key].tally)
				.reduce((p, c) => p + c, 0)
		}`
	);
}


module.exports = {
	Enable, Checkpoint, Print
};