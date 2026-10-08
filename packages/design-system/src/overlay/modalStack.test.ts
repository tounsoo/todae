import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshIsModal() {
  vi.resetModules();
  return (await import('./modalStack')).isModal;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isModal', () => {
  it('asks :modal when the engine knows it', async () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const isModal = await freshIsModal();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-modal', 'true');
    const matches = vi.spyOn(dialog, 'matches').mockReturnValue(false);
    expect(isModal(dialog)).toBe(false);
    expect(matches).toHaveBeenCalledWith(':modal');
  });

  it('falls back to aria-modal when the engine lacks :modal or CSS', async () => {
    for (const css of [{ supports: () => false }, undefined]) {
      vi.stubGlobal('CSS', css);
      const isModal = await freshIsModal();
      const dialog = document.createElement('dialog');
      expect(isModal(dialog)).toBe(false);
      dialog.setAttribute('aria-modal', 'true');
      expect(isModal(dialog)).toBe(true);
    }
  });
});
