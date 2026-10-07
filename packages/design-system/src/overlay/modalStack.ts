/** Modal <dialog> elements Todae opened, oldest first, so the last one is in front. */
const open: HTMLDialogElement[] = [];

export function pushModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index !== -1) open.splice(index, 1);
  open.push(el);
}

export function dropModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index !== -1) open.splice(index, 1);
}

/** The modal Todae opened last that is still open and in the document. */
export function frontModal(): HTMLDialogElement | null {
  for (let i = open.length - 1; i >= 0; i--) {
    const el = open[i]!;
    if (el.isConnected && el.open) return el;
  }
  return null;
}
