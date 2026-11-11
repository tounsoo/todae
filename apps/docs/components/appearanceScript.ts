/** Where the docs keep the reader's light or dark pick. */
export const APPEARANCE_KEY = 'todae-docs-appearance';

function appearanceScript(element: string): string {
  return `try{var a=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});if(a==='light'||a==='dark')${element}.setAttribute('data-appearance',a)}catch(e){}`;
}

export const HTML_APPEARANCE_SCRIPT = appearanceScript('document.documentElement');

export const SHELL_APPEARANCE_SCRIPT = appearanceScript("document.currentScript.closest('[data-appearance]')");
