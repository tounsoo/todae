/** Where the docs keep the reader's light or dark pick. */
export const APPEARANCE_KEY = 'todae-docs-appearance';

/**
 * Runs inside the shell, before the page paints: applies a stored
 * pick so the page doesn't flash the system appearance until hydration.
 */
export const APPEARANCE_SCRIPT = `try{var a=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});if(a==='light'||a==='dark')document.currentScript.closest('[data-appearance]').setAttribute('data-appearance',a)}catch(e){}`;
