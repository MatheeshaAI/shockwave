import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TSX_EXT = ['.ts', '.tsx'];

function tryFs(p) {
  if (existsSync(p) && statSync(p).isFile()) return p;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return nextResolve(specifier, context);
  }
  if (!context.parentURL) return nextResolve(specifier, context);

  const url = new URL(specifier, context.parentURL);
  let absPath = fileURLToPath(url);

  if (tryFs(absPath)) return nextResolve(specifier, context);

  const dotIdx = absPath.lastIndexOf('.');
  if (dotIdx > 0) {
    const stem = absPath.slice(0, dotIdx);
    for (const ext of TSX_EXT) {
      const candidate = stem + ext;
      if (tryFs(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  for (const ext of TSX_EXT) {
    if (tryFs(absPath + ext)) {
      return nextResolve(pathToFileURL(absPath + ext).href, context);
    }
  }

  return nextResolve(specifier, context);
}
