import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Alert,
  BottomSheet,
  Breadcrumbs,
  Chip,
  ChipList,
  Dialog,
  Pagination,
  StringsProvider,
  Toast,
  createToaster,
  useCombobox,
  useStrings,
  type Strings,
} from '../index';
import { Breadcrumbs as ServerBreadcrumbs } from '../server/breadcrumbs';
import { Pagination as ServerPagination } from '../server/pagination';
import { DEFAULT_STRINGS } from './strings';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const FRENCH: Strings = {
  close: 'Fermer',
  dismiss: 'Ignorer',
  notifications: 'Notifications FR',
  breadcrumbs: "Fil d'Ariane",
  pagination: 'Pages',
  resizeSheet: 'Redimensionner',
  options: 'Choix',
  removeChip: (label) => `Retirer ${label}`,
  removeAttachment: (name) => `Retirer ${name}`,
  moreChips: (count) => `${count} de plus`,
  moreChipsPanel: (count) => `${count} puces de plus`,
  characterLimit: (max) => `${max} caractères maximum`,
  charactersLeft: (remaining) => `${remaining} restants`,
  characterLimitReached: 'Limite atteinte',
  createOption: (query) => `Créer « ${query} »`,
  saturation: 'Saturation',
  brightness: 'Luminosité',
  hue: 'Teinte',
  colorPicker: 'Sélecteur de couleur',
  datePicker: 'Choisir une date',
  previousMonth: 'Mois précédent',
  nextMonth: 'Mois suivant',
  previousYears: 'Années précédentes',
  nextYears: 'Années suivantes',
  copied: 'Copié',
  copyFailed: 'Copie impossible',
  conversation: 'Conversation',
  scrollToLatest: 'Aller au dernier message',
  messageStarted: 'Nouveau message',
  messageFinished: 'Message terminé',
};

function strings(wrapper?: (props: { children: ReactNode }) => ReactNode) {
  return renderHook(() => useStrings(), { wrapper }).result.current;
}

describe('StringsProvider', () => {
  it('gives English for every key without a provider', () => {
    const english = strings();
    expect(english).toBe(DEFAULT_STRINGS);
    expect(Object.keys(english).sort()).toEqual(Object.keys(FRENCH).sort());
    expect(english.close).toBe('Close');
    expect(english.dismiss).toBe('Dismiss');
    expect(english.notifications).toBe('Notifications');
    expect(english.breadcrumbs).toBe('Breadcrumb');
    expect(english.pagination).toBe('Pagination');
    expect(english.resizeSheet).toBe('Resize sheet');
    expect(english.options).toBe('Options');
    expect(english.removeChip('Alpha')).toBe('Remove Alpha');
    expect(english.moreChips(3)).toBe('3 more');
    expect(english.moreChipsPanel(1)).toBe('1 more chip');
    expect(english.moreChipsPanel(2)).toBe('2 more chips');
    expect(english.characterLimit(10)).toBe('Up to 10 characters');
    expect(english.charactersLeft(1)).toBe('1 character left');
    expect(english.charactersLeft(2)).toBe('2 characters left');
    expect(english.characterLimitReached).toBe('Character limit reached');
    expect(english.createOption('Vue')).toBe('Create "Vue"');
    // Shared by every consumer, so no one can change the defaults for everyone.
    expect(Object.isFrozen(english)).toBe(true);
  });

  it('labels useCombobox\'s create row from the provider unless createLabel is set', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StringsProvider strings={FRENCH}>{children}</StringsProvider>
    );
    const label = (createLabel?: (query: string) => string) => {
      const { result } = renderHook(() => useCombobox({ options: [], allowCreate: true, createLabel }), { wrapper });
      act(() => result.current.setInputValue('Vue'));
      const row = result.current.items.find((item) => item.kind === 'create');
      return row && 'label' in row ? row.label : undefined;
    };
    expect(label()).toBe('Créer « Vue »');
    expect(label((query) => `Add ${query}`)).toBe('Add Vue');
  });

  it('merges each provider over the nearest one above, key by key', () => {
    const merged = strings(({ children }) => (
      <StringsProvider strings={{ close: 'Fermer', removeChip: (label) => `Retirer ${label}` }}>
        <StringsProvider strings={{ dismiss: 'Ignorer', close: undefined }}>
          <StringsProvider strings={{ close: 'Schließen' }}>{children}</StringsProvider>
        </StringsProvider>
      </StringsProvider>
    ));
    expect(merged.close).toBe('Schließen');
    expect(merged.dismiss).toBe('Ignorer');
    expect(merged.removeChip('Alpha')).toBe('Retirer Alpha');
    expect(merged.notifications).toBe('Notifications');
    expect(merged.charactersLeft(2)).toBe('2 characters left');

    // A key set to undefined keeps the parent's string.
    const kept = strings(({ children }) => (
      <StringsProvider strings={{ close: 'Fermer' }}>
        <StringsProvider strings={{ close: undefined }}>{children}</StringsProvider>
      </StringsProvider>
    ));
    expect(kept.close).toBe('Fermer');
  });

  it('names the parts that have no name of their own', () => {
    const toaster = createToaster();
    const sheetProps = renderHook(() => useCombobox({ options: [] }).getSheetProps(), {
      wrapper: ({ children }) => <StringsProvider strings={FRENCH}>{children}</StringsProvider>,
    }).result.current;
    expect(sheetProps['aria-label']).toBe('Choix');
    // Toast.Region sets up its host on a timer.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(
      <StringsProvider strings={FRENCH}>
        <Breadcrumbs.Root />
        <Pagination.Root />
        <Alert.Root>
          <Alert.Close>×</Alert.Close>
        </Alert.Root>
        <Chip.Root onRemove={() => undefined}>Alpha</Chip.Root>
        <Chip.Overflow overflowCount={3} />
        <Toast.Region toaster={toaster}>
          {(toast) => (
            <Toast.Root>
              {toast.title}
              <Toast.Close />
            </Toast.Root>
          )}
        </Toast.Region>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="d">
          <Dialog.Close>×</Dialog.Close>
        </Dialog.Root>
        <BottomSheet.Root open onOpenChange={() => undefined} aria-label="s">
          <BottomSheet.Close />
        </BottomSheet.Root>
      </StringsProvider>,
    );
    expect(screen.getByRole('navigation', { name: "Fil d'Ariane" })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retirer Alpha' })).toBeTruthy();
    expect(screen.getByText('3 de plus')).toBeTruthy();
    expect(document.querySelector('section[aria-label="Notifications FR"]')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Fermer', hidden: true })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Redimensionner', hidden: true })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(0));
    vi.useRealTimers();
    act(() => void toaster.add({ title: 'Saved' }));
    expect(screen.getAllByRole('button', { name: 'Ignorer', hidden: true })).toHaveLength(2);
  });

  it('names ChipList remove buttons from the provider', () => {
    render(
      <StringsProvider strings={FRENCH}>
        <ChipList.Root aria-label="Tags" chips={['a', 'b']} onRemove={() => undefined} />
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Retirer a' })).toBeTruthy();
  });

  it('lets a component prop win over the provider', () => {
    render(
      <StringsProvider strings={FRENCH}>
        <Breadcrumbs.Root aria-label="Trail" />
        <Pagination.Root aria-labelledby="pages-heading" />
        <h2 id="pages-heading">Results pages</h2>
        <Alert.Root>
          <Alert.Close aria-label="Hide">×</Alert.Close>
        </Alert.Root>
        <Chip.Root onRemove={() => undefined} removeLabel="Drop Alpha">
          Alpha
        </Chip.Root>
        <Chip.Overflow overflowCount={3} overflowLabel={(n) => `+${n} hidden`} />
      </StringsProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Trail' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Results pages' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Drop Alpha' })).toBeTruthy();
    expect(screen.getByText('+3 hidden')).toBeTruthy();
  });

  it('names a part whose aria-label is empty from the provider', () => {
    const toaster = createToaster();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    render(
      <StringsProvider strings={FRENCH}>
        <Breadcrumbs.Root aria-label="" />
        <Pagination.Root aria-label="" />
        <Alert.Root>
          <Alert.Close aria-label="">×</Alert.Close>
        </Alert.Root>
        <Chip.Root onRemove={() => undefined} removeLabel="">
          Alpha
        </Chip.Root>
        <Toast.Region toaster={toaster} aria-label="">
          {() => null}
        </Toast.Region>
        <BottomSheet.Root open onOpenChange={() => undefined} aria-label="s">
          <BottomSheet.Grabber aria-label="" />
          <BottomSheet.Close aria-label="" />
        </BottomSheet.Root>
      </StringsProvider>,
    );
    expect(screen.getByRole('navigation', { name: "Fil d'Ariane" })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retirer Alpha' })).toBeTruthy();
    expect(document.querySelector('section[aria-label="Notifications FR"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redimensionner', hidden: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer', hidden: true })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(0));
  });

  it('leaves the server entries of Breadcrumbs and Pagination in English', () => {
    render(
      <StringsProvider strings={FRENCH}>
        <ServerBreadcrumbs.Root />
        <ServerPagination.Root />
      </StringsProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  });
});
