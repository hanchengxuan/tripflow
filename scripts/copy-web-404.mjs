import { access, copyFile } from 'node:fs/promises';

const exportedNotFound = 'dist/+not-found.html';
const vercelNotFound = 'dist/404.html';

await access(exportedNotFound);
await copyFile(exportedNotFound, vercelNotFound);
