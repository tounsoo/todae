import { describe, expect, it, vi } from 'vitest';
import { createFieldRegistry, type StepperEntry } from './fieldRegistry.js';

const node = (tag = 'input') => document.createElement(tag);
const stepper = (inputId: string): StepperEntry => ({ step: () => {}, inputId, label: '', disabled: false, atMin: false, atMax: false });

describe('createFieldRegistry', () => {
  it('counts only a control, not a picker, as the field\'s control', () => {
    const registry = createFieldRegistry();
    const picker = {};
    registry.setControl(picker, { node: node('button'), role: 'picker', takesName: false });
    expect(registry.hasControl()).toBe(false);
    const control = {};
    registry.setControl(control, { node: node(), role: 'control', takesName: false });
    expect(registry.hasControl()).toBe(true);
    registry.setControl(control, null);
    expect(registry.hasControl()).toBe(false);
  });

  it('says whether a control other than the asker took the field\'s name', () => {
    const registry = createFieldRegistry();
    const named = {};
    const other = {};
    registry.setControl(named, { node: node(), role: 'control', takesName: true });
    registry.setControl(other, { node: node(), role: 'control', takesName: false });
    expect(registry.namedBy(other)).toBe(true);
    expect(registry.namedBy(named)).toBe(false);
    expect(registry.namedBy()).toBe(true);
  });

  it('focuses the last control to mount, else the last picker', () => {
    const registry = createFieldRegistry();
    const button = node('button');
    registry.setControl({}, { node: button, role: 'picker', takesName: false });
    expect(registry.focusTarget()).toBe(button);
    const first = {};
    const firstNode = node();
    registry.setControl(first, { node: firstNode, role: 'control', takesName: false });
    const second = {};
    const secondNode = node();
    registry.setControl(second, { node: secondNode, role: 'control', takesName: false });
    expect(registry.focusTarget()).toBe(secondNode);
    // A control that attaches a new node counts as the last to mount.
    const remounted = node();
    registry.setControl(first, { node: remounted, role: 'control', takesName: false });
    expect(registry.focusTarget()).toBe(remounted);
    registry.setControl(first, null);
    registry.setControl(second, null);
    expect(registry.focusTarget()).toBe(button);
  });

  it('finds a picker\'s toggle by its button', () => {
    const registry = createFieldRegistry();
    const toggle = vi.fn();
    const button = node('button');
    registry.setControl({}, { node: button, role: 'picker', takesName: false, toggle });
    const input = node();
    registry.setControl({}, { node: input, role: 'control', takesName: false });
    expect(registry.toggleFor(button)).toBe(toggle);
    expect(registry.toggleFor(input)).toBeUndefined();
    expect(registry.toggleFor(null)).toBeUndefined();
  });

  it('notifies only when something changed', () => {
    const registry = createFieldRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const owner = {};
    const el = node();
    registry.setControl(owner, { node: el, role: 'control', takesName: false });
    registry.setControl(owner, { node: el, role: 'control', takesName: false });
    expect(listener).toHaveBeenCalledTimes(1);
    registry.setControl(owner, { node: el, role: 'control', takesName: true });
    expect(listener).toHaveBeenCalledTimes(2);
    registry.publishText(owner, { value: 'a' });
    registry.publishText(owner, { value: 'a' });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('keeps a text until its own control withdraws it', () => {
    const registry = createFieldRegistry();
    const a = {};
    const b = {};
    registry.publishText(a, { value: 'a', maxLength: 5 });
    registry.publishText(b, { value: 'b' });
    registry.publishText(a, null);
    expect(registry.text()).toEqual({ value: 'b' });
    registry.publishText(b, null);
    expect(registry.text()).toBeNull();
  });

  it('serves the rendered text to the server snapshot only until a text is committed', () => {
    const registry = createFieldRegistry();
    registry.seedText({ value: 'hello', maxLength: 10 });
    expect(registry.text()).toBeNull();
    expect(registry.serverText()).toEqual({ value: 'hello', maxLength: 10 });
    const owner = {};
    registry.publishText(owner, { value: 'hello', maxLength: 10 });
    registry.publishText(owner, null);
    registry.seedText({ value: 'later' });
    expect(registry.serverText()).toBeNull();
  });

  it('steps the last number input published, and lets each withdraw only its own', () => {
    const registry = createFieldRegistry();
    const a = {};
    const b = {};
    expect(registry.publishStepper(a, stepper('a'))).toBe(false);
    expect(registry.publishStepper(b, stepper('b'))).toBe(true);
    registry.withdrawStepper(a);
    expect(registry.stepper()?.inputId).toBe('b');
    registry.withdrawStepper(b);
    expect(registry.stepper()).toBeNull();
  });

  it('gives the first value input in the document, in document order', () => {
    const registry = createFieldRegistry();
    const shell = node('div');
    document.body.append(shell);
    const first = document.createElement('input');
    const second = document.createElement('input');
    shell.append(first, second);
    const removeSecond = registry.addValueInput(second);
    const removeFirst = registry.addValueInput(first);
    expect(registry.firstValueInput()).toBe(first);
    first.remove();
    expect(registry.firstValueInput()).toBe(second);
    removeFirst();
    removeSecond();
    expect(registry.firstValueInput()).toBeNull();
    shell.remove();
  });
});
