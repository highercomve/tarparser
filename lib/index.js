const BLOCK_SIZE = 512;
const FILE_TYPE = {
	GZIP: "GZIP",
	GZIP2: "GZIP2",
	TAR: "TAR",
	PLAIN: "PLAIN",
};

/**
 * @typedef FileDescription
 * @property {string} name - The name of the file.
 * @property {"file"|"directory"} type - The type of the file, either "file" or "directory".
 * @property {number} size - The size of the file in bytes.
 * @property {Uint8Array} data - The binary data of the file content.
 * @property {string} text - A getter to decode and return the file content as a UTF-8 string.
 * @property {FileAttrs} attrs - file attributes
 */

/**
 * @typedef FileAttrs
 * @property {string} mode - The file permissions in octal format.
 * @property {number} uid - User ID of the file owner.
 * @property {number} gid - Group ID of the file owner.
 * @property {number} mtime - Last modification time in Unix time format.
 * @property {string} user - The username of the file owner.
 * @property {string} group - The group name of the file owner.
 */

/**
 * Parses a tar file from binary data and returns an array of FileDescription objects.
 * @param {ArrayBuffer|Uint8Array} data - The binary data of the tar file.
 * @returns {Promise<FileDescription[]>} - An array of FileDescription objects representing the parsed files in the tar archive.
 */
export async function parseTar(data) {
	let buffer = data.buffer || data;

	const ftype = checkFileType(buffer);
	if (ftype != FILE_TYPE.GZIP && ftype != FILE_TYPE.TAR) {
		throw new Error("The file format should be tar.gz or tar");
		return;
	}

	if (ftype == FILE_TYPE.GZIP) {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(data));
				controller.close();
			},
		}).pipeThrough(new DecompressionStream("gzip"));

		buffer = await new Response(stream).arrayBuffer();
	}

	const files = [];
	let offset = 0;

	// TAR files consist of 512-byte blocks. Each file is preceded by a header block
	// followed by data blocks. The archive ends with two consecutive null blocks.
	while (offset < buffer.byteLength - BLOCK_SIZE) {
		// File name (100 bytes, null-terminated string)
		// In POSIX ustar format, this field stores the file name for short names
		// or a prefix for long names
		let name = readString(buffer, offset, 100);
		if (name.length === 0) {
			break;
		}

		// In case is a long name we need to added to the name
		const prefix = readString(buffer, offset + 345, 155);
		if (prefix) {
			name = `${prefix}${name}`;
		}

		// File mode (8 bytes, octal number stored as ASCII)
		// This represents the file permissions in octal format
		const mode = readString(buffer, offset + 100, 8);

		// File uid (8 bytes, octal number stored as ASCII)
		// User ID of the file owner
		const uid = Number.parseInt(readString(buffer, offset + 108, 8));

		// File gid (8 bytes, octal number stored as ASCII)
		// Group ID of the file owner
		const gid = Number.parseInt(readString(buffer, offset + 116, 8));

		// File size (12 bytes, octal number stored as ASCII)
		// Size of the file in bytes
		const size = readNumber(buffer, offset + 124, 12);

		// File mtime (12 bytes, octal number stored as ASCII)
		// Last modification time in Unix time format
		const mtime = readNumber(buffer, offset + 136, 12);

		// File type flag (1 byte)
		// 0 or '\0': normal file
		// 5: directory
		// Other values represent special file types (e.g., symbolic links)
		const _type = readNumber(buffer, offset + 156, 1);
		const type = _type === 0 ? "file" : _type === 5 ? "directory" : _type;

		// File owner username (32 bytes, null-terminated string)
		// Present in POSIX ustar format
		const user = readString(buffer, offset + 265, 32);

		// File owner group name (32 bytes, null-terminated string)
		// Present in POSIX ustar format
		const group = readString(buffer, offset + 297, 32);

		const fileStart = offset + BLOCK_SIZE;
		const fileEnd = fileStart + size;

		// File data
		// For regular files, this contains the file contents
		// For directories, this is empty (size should be 0)
		const data = new Uint8Array(buffer, fileStart, size);

		files.push({
			name,
			type,
			size,
			data,
			get text() {
				return new TextDecoder().decode(this.data);
			},
			attrs: {
				mode,
				uid,
				gid,
				mtime,
				user,
				group,
			},
		});

		// Move to the next file
		// The offset is increased by:
		// 1. 512 bytes for the header
		// 2. The file size rounded up to the nearest 512 bytes
		offset += 512 + 512 * Math.trunc(size / 512);
		if (size % 512) {
			offset += 512;
		}
	}

	return files;
}

/**
 * checkFileType function to check file type using a buffer
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data of the file.
 * @returns {string} - The type of the file as defined in FILE_TYPE object.
 */
function checkFileType(buffer) {
	// Read the first 2 bytes (for gzip check)
	let bytes = readBytes(buffer, 0, 2);
	if (bufferToHex(bytes) === "1f8b") {
		return FILE_TYPE.GZIP;
	}

	// Read the first 5 bytes (for bzip2 check)
	bytes = readBytes(buffer, 0, 5);
	if (bufferToHex(bytes) === "425a683931") {
		return FILE_TYPE.GZIP2;
	}

	// Read 5 bytes starting at offset 257 (for tar check)
	bytes = readBytes(buffer, 257, 5);
	if (bufferToHex(bytes) === "7573746172") {
		return FILE_TYPE.TAR;
	}

	return FILE_TYPE.PLAIN;
}

/**
 * Reads a null-terminated string from a buffer at a specified offset and size.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data of the buffer.
 * @param {number} offset - The starting offset in the buffer.
 * @param {number} size - The number of bytes to read.
 * @returns {string} - The string read from the buffer.
 */
function readString(buffer, offset, size) {
	const view = new Uint8Array(buffer, offset, size);
	const i = view.indexOf(0);
	const td = new TextDecoder();
	return td.decode(view.slice(0, i));
}

/**
 * Reads an 8-bit number from a buffer at a specified offset and size.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data of the buffer.
 * @param {number} offset - The starting offset in the buffer.
 * @param {number} size - The number of bytes to read (must be 12 for mtime).
 * @returns {number} - The numeric value read from the buffer.
 */
function readNumber(buffer, offset, size) {
	const view = new Uint8Array(buffer, offset, size);
	let str = "";
	for (let i = 0; i < size; i++) {
		str += String.fromCodePoint(view[i]);
	}
	return Number.parseInt(str, 8);
}

/**
 * Reads specific bytes from a buffer.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data of the buffer.
 * @param {number} start - The starting offset in the buffer.
 * @param {number} length - The number of bytes to read.
 * @returns {ArrayBuffer|Uint8Array} - A view into the Buffer containing the specified bytes.
 */
function readBytes(buffer, start, length) {
	return buffer.slice(start, start + length);
}

/**
 * Converts a buffer to a hex string representation.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data buffer.
 * @returns {string} - A hexadecimal string representing the buffer contents.
 */
function bufferToHex(buffer) {
	const uint8Array = new Uint8Array(buffer);
	let hexString = "";

	for (let i = 0; i < uint8Array.length; i++) {
		hexString += uint8Array[i].toString(16).padStart(2, "0");
	}

	return hexString;
}
