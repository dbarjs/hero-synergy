/**
 * Joins a root and repo-relative parts with `/`. The root is whatever the
 * platform gave (a POSIX path, a `C:/…` path from git, a `C:\…` path from VS
 * Code); the parts are always POSIX, and Node accepts the mix on Windows.
 */
export const joinPath = (root: string, ...parts: ReadonlyArray<string>): string =>
  [root.replace(/[\\/]+$/, ''), ...parts].join('/')
