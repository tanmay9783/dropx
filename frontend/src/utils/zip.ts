/**
 * Pure TypeScript Zero-Dependency ZIP Archive Builder (PKZip 2.0 compliant)
 * Encodes files and directory hierarchies directly in the browser into a standard .zip Blob.
 */

// Precomputed CRC32 table for IEEE 802.3
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCRC32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  path: string; // e.g. "photos/beach.png" or "document.pdf"
  data: Uint8Array;
  lastModified?: Date;
}

/**
 * Creates a standard uncompressed (store) ZIP archive from an array of file entries.
 * Compatible with Windows Explorer, macOS Archive Utility, Linux unzip, iOS, and Android.
 */
export function createZipBlob(entries: ZipFileEntry[]): Blob {
  const localHeaders: Uint8Array[] = [];
  const centralDirectoryHeaders: Uint8Array[] = [];
  let currentOffset = 0;

  const encoder = new TextEncoder();

  for (const entry of entries) {
    const rawPath = entry.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const pathBytes = encoder.encode(rawPath);
    const dataBytes = entry.data;
    const crc = computeCRC32(dataBytes);
    const size = dataBytes.length;

    // Convert Date to MS-DOS date & time
    const date = entry.lastModified || new Date();
    const dosTime =
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((Math.floor(date.getSeconds() / 2) & 0x1f));
    const dosDate =
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f);

    // --- Local File Header (30 bytes + path length) ---
    const localHeader = new Uint8Array(30 + pathBytes.length);
    const lView = new DataView(localHeader.buffer);

    lView.setUint32(0, 0x04034b50, true); // Local header signature
    lView.setUint16(4, 20, true);         // Version needed to extract (2.0)
    lView.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8 filename)
    lView.setUint16(8, 0, true);          // Compression method (0 = Store / Uncompressed)
    lView.setUint16(10, dosTime, true);   // Last mod file time
    lView.setUint16(12, dosDate, true);   // Last mod file date
    lView.setUint32(14, crc, true);       // CRC-32
    lView.setUint32(18, size, true);      // Compressed size
    lView.setUint32(22, size, true);      // Uncompressed size
    lView.setUint16(26, pathBytes.length, true); // File name length
    lView.setUint16(28, 0, true);         // Extra field length
    localHeader.set(pathBytes, 30);

    localHeaders.push(localHeader);
    localHeaders.push(dataBytes);

    // --- Central Directory Header (46 bytes + path length) ---
    const cdHeader = new Uint8Array(46 + pathBytes.length);
    const cdView = new DataView(cdHeader.buffer);

    cdView.setUint32(0, 0x02014b50, true); // Central directory signature
    cdView.setUint16(4, 20, true);         // Version made by (2.0)
    cdView.setUint16(6, 20, true);         // Version needed to extract (2.0)
    cdView.setUint16(8, 0x0800, true);     // General purpose bit flag (UTF-8)
    cdView.setUint16(10, 0, true);         // Compression method (0 = Store)
    cdView.setUint16(12, dosTime, true);   // Last mod file time
    cdView.setUint16(14, dosDate, true);   // Last mod file date
    cdView.setUint32(16, crc, true);       // CRC-32
    cdView.setUint32(20, size, true);      // Compressed size
    cdView.setUint32(24, size, true);      // Uncompressed size
    cdView.setUint16(28, pathBytes.length, true); // File name length
    cdView.setUint16(30, 0, true);         // Extra field length
    cdView.setUint16(32, 0, true);         // File comment length
    cdView.setUint16(34, 0, true);         // Disk number start
    cdView.setUint16(36, 0, true);         // Internal file attributes
    cdView.setUint32(38, 0, true);         // External file attributes
    cdView.setUint32(42, currentOffset, true); // Relative offset of local header
    cdHeader.set(pathBytes, 46);

    centralDirectoryHeaders.push(cdHeader);

    // Advance offset: local header + filename length + data length
    currentOffset += localHeader.length + dataBytes.length;
  }

  // Calculate central directory size
  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;
  for (const cd of centralDirectoryHeaders) {
    centralDirectorySize += cd.length;
  }

  // --- End of Central Directory Record (22 bytes) ---
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true); // EOCD signature
  eView.setUint16(4, 0, true);          // Number of this disk
  eView.setUint16(6, 0, true);          // Disk where central directory starts
  eView.setUint16(8, entries.length, true);  // Number of central directory records on this disk
  eView.setUint16(10, entries.length, true); // Total number of central directory records
  eView.setUint32(12, centralDirectorySize, true); // Size of central directory
  eView.setUint32(16, centralDirectoryOffset, true); // Offset of start of central directory
  eView.setUint16(20, 0, true);         // ZIP file comment length

  // Combine local headers, data chunks, central directory headers, and EOCD into a Blob
  const allParts: any[] = [...localHeaders, ...centralDirectoryHeaders, eocd];
  return new Blob(allParts, { type: 'application/zip' });
}
