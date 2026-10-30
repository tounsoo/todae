// The token consistency check dropped a block when the sheet contained the
// literal "@media (forced-colors: active)", including a query that continues
// after that text. PostCSS keeps the query in `params`, so this is the same cut.
export function forcedColorsQuery(node) {
  return (
    node?.type === 'atrule' &&
    node.name === 'media' &&
    `@media ${node.params}`.includes('@media (forced-colors: active)')
  );
}

export function insideForcedColors(node) {
  let current = node.parent;
  while (current) {
    if (forcedColorsQuery(current)) return true;
    current = current.parent;
  }
  return false;
}
