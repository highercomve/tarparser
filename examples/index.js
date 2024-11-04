import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { parseTar } from "./lib/index.js";

// Get the tar file path from command line arguments
const args = process.argv;
if (args.length < 3) {
	console.error("Usage: node index.js <path_to_tar_file>");
	process.exit(1);
}

const tarFilePath = args[2];

// Read the tar file as a buffer
const tarBuffer = new Uint8Array(readFileSync(tarFilePath));

// Parse the tar file
parseTar(tarBuffer)
	.then((files) => {
		files.forEach((file) => {
			if (file.type == "file" && file.data) {
				const path = "./" + dirname(file.name);
				if (!existsSync(path)) {
					mkdirSync(path, { recursive: true });
				}
				writeFileSync(`./${file.name}`, file.data);
			}
		});
	})
	.catch(console.error);
