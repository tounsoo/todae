import { describe, expect, it } from 'vitest';
import { CLOSES_PARAGRAPH, contentPolicyError, resolveSurface } from './Tooltip.surface.js';

describe('Tooltip.surface', () => {
  it('rejects tabbables in tip content', () => {
    const tip = resolveSurface(false, 'tip-1');
    const el = document.createElement('div');
    el.textContent = 'Archive';
    expect(contentPolicyError(tip, el)).toBeNull();
    el.innerHTML = '<a href="/tooltip">Read the policy</a>';
    expect(contentPolicyError(tip, el)).toBe(
      'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.',
    );
  });

  it('allows only href links in panel content', () => {
    const panel = resolveSurface(true, 'panel-1');
    const el = document.createElement('div');
    el.innerHTML = '<a href="/tooltip">Read the policy</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
    el.innerHTML = '<button type="button">No</button>';
    expect(contentPolicyError(panel, el)).toBe(
      'Interactive Tooltip allows links only. Use Popover.',
    );
    el.innerHTML = '<a>Missing href</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
  });

  it('flags a control with a negative tabindex or under aria-hidden', () => {
    const tip = resolveSurface(false, 'tip-1');
    const panel = resolveSurface(true, 'panel-1');
    const el = document.createElement('div');
    for (const html of [
      '<button type="button" tabindex="-1">Undo</button>',
      '<button type="button" aria-hidden="true">Undo</button>',
      '<span aria-hidden="true"><button type="button">Undo</button></span>',
    ]) {
      el.innerHTML = html;
      expect(contentPolicyError(tip, el)).toBe(
        'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.',
      );
      expect(contentPolicyError(panel, el)).toBe('Interactive Tooltip allows links only. Use Popover.');
    }
  });

  it('rejects content that would close a paragraph', () => {
    const error = 'Tooltip holds phrasing content only, such as text, links and spans, so it can sit in a paragraph.';
    for (const surface of [resolveSurface(false, 'tip-1'), resolveSurface(true, 'panel-1')]) {
      const el = document.createElement('span');
      el.innerHTML = '<strong>Popover API</strong><br><span>developer.mozilla.org</span>';
      expect(contentPolicyError(surface, el)).toBeNull();
      for (const tag of CLOSES_PARAGRAPH.split(',')) {
        el.replaceChildren(document.createElement(tag));
        expect(contentPolicyError(surface, el)).toBe(error);
      }
    }
  });

  it('lists exactly the elements that make the HTML parser close a paragraph', () => {
    // Most elements of HTML's element index; head-only and foreign elements, which never close a paragraph,
    // and table parts, which the parser drops in body content, are left out. The parser decides which end an open <p>.
    const elements =
      'a,abbr,address,area,article,aside,audio,b,bdi,bdo,blockquote,br,button,canvas,center,cite,code,data,datalist,dd,del,details,dfn,dialog,dir,div,dl,dt,em,embed,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,i,iframe,img,input,ins,kbd,label,li,listing,main,map,mark,menu,meter,nav,object,ol,output,p,picture,plaintext,pre,progress,q,ruby,s,samp,search,section,select,slot,small,span,strong,sub,summary,sup,table,template,textarea,time,u,ul,var,video,wbr,xmp';
    const listed = new Set(CLOSES_PARAGRAPH.split(','));
    expect([...listed].filter((tag) => !elements.split(',').includes(tag))).toEqual([]);
    for (const tag of elements.split(',')) {
      const doc = new DOMParser().parseFromString(`<!doctype html><p>a<${tag}>b</${tag}></p>`, 'text/html');
      const closes = doc.querySelector(`p ${tag}`) === null;
      expect({ tag, listed: listed.has(tag) }).toEqual({ tag, listed: closes });
    }
  });
});
