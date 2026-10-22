/** Problem with a display name, or null if it's fine. Lengths over 40 are refused by the schemas. */
export function displayNameProblem(name: string): string | null {
  return name.length < 2 ? 'Enter a display name of at least 2 characters.' : null;
}
