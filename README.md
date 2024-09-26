# TAR Archive Parser

A JavaScript library to parse `.tar` and `.tar.gz` (gzip-compressed tarballs) files. It supports extracting file metadata and content directly in the browser or Node.js environments.

## Features

- Supports TAR and GZIP file formats.
- Extracts file names, sizes, and content.
- Handles file attributes such as permissions, ownership, and modification time.
- Supports both short and long file names in TAR archives.

## Installation

You can install the library using npm or include it via a `<script>` tag.

### Using npm

```bash
npm install tarparser
```

```html
<script src="tarparser.js"></script>
```

## Usage

### Parsing a .tar or .tar.gz file

Import the parseTar function to start using the library:

```
import { parseTar } from 'tarparser';
```

## Example: Parsing a .tar.gz file
```
// Select file input from DOM
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];

  // Read file as ArrayBuffer
  const buffer = await file.arrayBuffer();

  // Parse the .tar.gz file
  const tarFiles = await parseTar(buffer);

  // Log file names and content
  tarFiles.forEach(file => {
    console.log(`Name: ${file.name}`);
    console.log(`Content: ${file.text}`);
  });
});
```

## API
`parseTar(data: ArrayBuffer | Uint8Array): Promise<TarFileItem[]>`

* data: The binary data of the TAR archive, either .tar or .tar.gz.
* Returns: A Promise that resolves to an array of file items.

Each file item has the following properties:

* name: The file name.
* size: The size of the file in bytes.
* type: The type of the item (file or directory).
* data: The binary data of the file (Uint8Array).
* text: A decoded string of the file contents (only for files).
* attrs: Object containing file metadata like mode, uid, gid, mtime, user, and group.

File Attributes

* mode: File permissions in octal format.
* uid: User ID of the file owner.
* gid: Group ID of the file owner.
* mtime: Last modification time (Unix timestamp).
* user: Owner's username.
* group: Owner's group name.

File Types Supported

* GZIP: Gzip-compressed tarball.
* TAR: Standard TAR archive.
