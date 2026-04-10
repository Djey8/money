/**
 * Checks if a title already exists in one or more arrays.
 * @param title - The title to search for.
 * @param arrays - One or more arrays of objects to search through.
 * @param field - The property name to compare against (default: 'title').
 * @returns True if the title is found (invalid/duplicate), false otherwise.
 */
export function isDuplicateTitle(title: string, arrays: any[][], field: string = 'title'): boolean {
  return arrays.some(arr => arr.some(item => item[field] === title));
}
