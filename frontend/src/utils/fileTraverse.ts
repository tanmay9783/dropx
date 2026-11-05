/**
 * HTML5 Directory & File System Traversal Helper
 * Recursively extracts files from dragged folders and preserves their relative path hierarchy.
 */

export interface TraversedFile {
  file: File;
  relativePath: string;
}

/**
 * Traverses a DataTransferItemList containing files and/or dropped folders.
 */
export async function traverseDataTransferItems(items: DataTransferItemList): Promise<TraversedFile[]> {
  const results: TraversedFile[] = [];

  const entryPromises: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;

    // Standard webkitGetAsEntry supported in Chrome, Firefox, Edge, Safari
    if (typeof (item as any).webkitGetAsEntry === 'function') {
      const entry = (item as any).webkitGetAsEntry();
      if (entry) {
        entryPromises.push(traverseEntry(entry, '', results));
        continue;
      }
    }

    // Fallback if webkitGetAsEntry is unavailable
    const file = item.getAsFile();
    if (file) {
      results.push({ file, relativePath: file.name });
    }
  }

  await Promise.all(entryPromises);
  return results;
}

async function traverseEntry(entry: any, currentPath: string, results: TraversedFile[]): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
          results.push({ file, relativePath });
          resolve();
        },
        () => resolve() // Ignore read errors gracefully
      );
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

    // createReader.readEntries must be called repeatedly until an empty array is returned per spec
    const readAllEntries = async (): Promise<any[]> => {
      const allEntries: any[] = [];
      const readNext = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries((entries: any[]) => resolve(entries), () => resolve([]));
        });

      let batch: any[];
      do {
        batch = await readNext();
        if (batch.length > 0) {
          allEntries.push(...batch);
        }
      } while (batch.length > 0);

      return allEntries;
    };

    const entries = await readAllEntries();
    await Promise.all(entries.map((childEntry) => traverseEntry(childEntry, subPath, results)));
  }
}

