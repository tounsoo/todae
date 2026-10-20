import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A file in the `@tounsoo/todae` package: through the docs app's dependency link, or at the workspace path a deployment traces. */
export function packageFile(cwd: string, ...path: string[]): string | undefined {
  return [join(cwd, 'node_modules', '@tounsoo', 'todae', ...path), join(cwd, '..', '..', 'packages', 'design-system', ...path)].find(
    (file) => existsSync(file),
  );
}
