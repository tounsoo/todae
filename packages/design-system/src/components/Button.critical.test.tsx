import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Button, Dialog, Drilldown, Menu, Toast, ToggleGroup, type ButtonVariant } from '../index.js';

afterEach(cleanup);

describe('critical button variant', () => {
  it('is one of the base ButtonVariants, which stay open for a company augmentation', () => {
    expectTypeOf<ButtonVariant>().toEqualTypeOf<'primary' | 'secondary' | 'ghost' | 'critical'>();
    expectTypeOf<ButtonVariant>().toEqualTypeOf<keyof import('./Button.js').ButtonVariants>();
  });

  it('reaches Menu.Trigger, Dialog.Close, Toast.Action, ToggleGroup.Item and a link drawn as a button', () => {
    const ref = createRef<HTMLElement>();
    render(
      <>
        <Drilldown.Root defaultValue={['home']}>
          <Drilldown.Trigger value="more" variant="critical">
            More
          </Drilldown.Trigger>
        </Drilldown.Root>
        <Menu.Root>
          <Menu.Trigger variant="critical">Delete</Menu.Trigger>
          <Menu.Content>
            <Menu.Item>Delete</Menu.Item>
          </Menu.Content>
        </Menu.Root>
        <Dialog.Root open aria-label="Delete account">
          <Dialog.Close variant="critical">Delete account</Dialog.Close>
        </Dialog.Root>
        <Toast.Action variant="critical">Delete toast</Toast.Action>
        <Toast.Close variant="critical">Close toast</Toast.Close>
        <ToggleGroup.Root aria-label="Danger">
          <ToggleGroup.Item value="delete" variant="critical">
            Delete item
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <Button.Root variant="critical" ref={ref} render={(props) => <a {...props} href="/delete" />}>
          Delete link
        </Button.Root>
      </>,
    );

    expect(document.querySelectorAll('[data-button-variant="critical"]')).toHaveLength(7);
    const link = screen.getByRole('link', { name: 'Delete link' });
    expect(link.getAttribute('data-button-variant')).toBe('critical');
    expect(ref.current).toBe(link);
    expect(screen.getByRole('button', { name: 'Delete account' }).getAttribute('data-button-variant')).toBe('critical');
    const group = screen.getByRole('group', { name: 'Danger' });
    expect(group.querySelector('button')?.getAttribute('data-button-variant')).toBe('critical');
  });
});
