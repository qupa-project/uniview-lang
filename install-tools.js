const unzipper = require('unzipper');
const https = require('https');
const fs = require('fs');
const os = require('os');

/**
 * Download a resource from `url` to `dest`.
 * @param {string} url - Valid URL to attempt download of resource
 * @param {string} dest - Valid path to save the file.
 * @returns {Promise<void>} - Returns asynchronously when successfully completed download
 */
function Download(url, dest) {
	return new Promise((resolve, reject) => {
		// Check file does not exist yet before hitting network
		fs.access(dest, fs.constants.F_OK, (err) => {

				if (err === null) reject('File already exists');

				const request = https.get(url, response => {
						if (response.statusCode === 200) {

							const file = fs.createWriteStream(dest, { flags: 'wx' });
							file.on('finish', () => resolve());
							file.on('error', err => {
								file.close();
								if (err.code === 'EEXIST') reject('File already exists');
								else fs.unlink(dest, () => reject(err.message)); // Delete temp file
							});
							response.pipe(file);
						} else if (response.statusCode === 302 || response.statusCode === 301) {
							//Recursively follow redirects, only a 200 will resolve.
							Download(response.headers.location, dest).then(resolve);
						} else {
							reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
						}
					});

					request.on('error', err => {
						reject(err.message);
					});
		});
	});
}


function Unzip(from, to) {
	return new Promise((res, rej) => {
		let stream = fs.createReadStream(from);
		stream.pipe(unzipper.Extract({path: to}));
		stream.on('close', res);
	});
}




async function InstallTools() {
	console.info("Installing Tools...");

	if (os.platform() == "win32") {
		console.info("  The Windows version of LLVM does not contain certain prebuilt required tools");
		console.info("  Now locally installing tools for use");

		console.info("  Downloading tools from https://github.com/qupa-project/uniview-lang/releases/tag/tools")
		await Download(
			'https://github.com/qupa-project/uniview-lang/releases/download/tools/tools.zip',
			'./tools/tools.zip'
		);

		console.info("  Unzipping tools...");
		await Unzip('./tools/tools.zip', './tools/');

		console.info("  Installation complete");
		console.info("  Running cleanup");
		fs.unlinkSync('./tools/tools.zip');
	}
}

InstallTools()
	.catch(console.error);