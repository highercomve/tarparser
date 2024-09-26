import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseTar } from "./lib/index.js";

// Get the tar file path from command line arguments
const args = process.argv;
if (args.length < 3) {
	console.error("Usage: bun index.js <path_to_tar_file>");
	process.exit(1);
}

const tarFilePath = args[2];

// Read the tar file as a buffer
const tarBuffer = new Uint8Array(readFileSync(tarFilePath));

// Parse the tar file
parseTar(tarBuffer)
	.then((files) => {
		files.forEach((file) => {
			console.log(
				`File: ${file.name}, Size: ${file.size} bytes, mode: ${file.attrs.mode}`,
			);
		});
	})
	.catch(console.error);
