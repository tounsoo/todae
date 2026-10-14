'use client';

import { Button, Composer, DensityProvider, Description, ErrorMessage, Field, Fieldset, Label, Stack, Text, ThemeProvider, formatDate, normalizeHex, parseDate, useChipField, useField } from '@omsoo.design/todae';
import { useId, useState } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

export function FieldStates() {
  const [value, setValue] = useState('');
  return (
    <>
      <Field.Root aria-label="Idle field">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} placeholder="Idle" />
      </Field.Root>
      <Field.Root aria-label="Disabled field" disabled>
        <Field.TextInput value="Disabled" onChange={() => undefined} />
      </Field.Root>
      <Field.Root aria-label="Invalid field" invalid>
        <Field.TextInput value="Invalid" onChange={() => undefined} />
      </Field.Root>
    </>
  );
}

export function FieldLabelStates() {
  const idleId = useId();
  const disabledId = useId();
  const invalidId = useId();
  const [email, setEmail] = useState('');
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={idleId}>Email</Label.Root>
        <Field.Root id={idleId}>
          <Field.TextInput
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={disabledId}>Email</Label.Root>
        <Field.Root id={disabledId} disabled>
          <Field.TextInput value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={invalidId}>Email</Label.Root>
        <Field.Root id={invalidId} invalid>
          <Field.TextInput value="Invalid" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
    </>
  );
}

export function FieldLabelAdornments() {
  const searchId = useId();
  const amountId = useId();
  const [search, setSearch] = useState('query');
  const [amount, setAmount] = useState('12');
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={searchId}>Search</Label.Root>
        <Field.Root id={searchId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={amountId}>Amount</Label.Root>
        <Field.Root id={amountId}>
          <Field.Affix>$</Field.Affix>
          <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Field.Affix>USD</Field.Affix>
        </Field.Root>
      </Field.Group>
    </>
  );
}

export function FieldAdornments() {
  const [amount, setAmount] = useState('12');
  const [search, setSearch] = useState('query');
  return (
    <>
      <Field.Root aria-label="Amount">
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field.Affix>.00</Field.Affix>
      </Field.Root>
      <Field.Root aria-label="Search">
        <Field.Icon>
          <span>⌕</span>
        </Field.Icon>
        <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} />
        <Field.Icon interactive>
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
            Clear
          </button>
        </Field.Icon>
      </Field.Root>
    </>
  );
}

export function TextareaRows() {
  const [value, setValue] = useState('Notes');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
    </Field.Root>
  );
}

export function TextareaAutoGrow() {
  const [value, setValue] = useState('Grows up to six rows.');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} autoGrow maxRows={6} />
    </Field.Root>
  );
}

export function TextareaMaxRows() {
  const [value, setValue] = useState('maxRows only');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} maxRows={2} />
    </Field.Root>
  );
}

export function TextareaResize() {
  const [value, setValue] = useState('Drag between rows and maxRows.');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} maxRows={6} />
    </Field.Root>
  );
}

export function TextareaDensity() {
  const [value, setValue] = useState('Density');
  return (
    <>
      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
        <DensityProvider key={density} density={density}>
          <Field.Root aria-label="Note">
            <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
          </Field.Root>
        </DensityProvider>
      ))}
    </>
  );
}

export function TextareaDark() {
  const [value, setValue] = useState('Dark scrollbar\n'.repeat(8).trim());
  return (
    <ThemeProvider appearance="dark">
      <Field.Root aria-label="Note">
        <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} maxRows={4} />
      </Field.Root>
    </ThemeProvider>
  );
}

export function TextareaMessages() {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const disabledId = useId();
  const [value, setValue] = useState('missing');
  const invalid = value.trim().length < 8;
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={id}>Note</Label.Root>
        <Field.Root id={id} invalid={invalid} aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}>
          <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
        </Field.Root>
        <Description.Root id={hintId}>A short description of the work.</Description.Root>
        {invalid ? <ErrorMessage.Root id={errorId}>Use at least 8 characters.</ErrorMessage.Root> : null}
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={disabledId}>Note</Label.Root>
        <Field.Root id={disabledId} disabled>
          <Field.Textarea value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </Field.Group>
    </>
  );
}

export function ChipInputControlled() {
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <Field.Root aria-label="Tags">
      <Field.ChipInput
        chips={chips}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onCommit={(value) => {
          setChips((prev) => (prev.includes(value) ? prev : [...prev, value]));
          setInputValue('');
        }}
        onChipRemove={(index) => setChips((prev) => prev.filter((_, i) => i !== index))}
        placeholder="Type and press Enter"
      />
    </Field.Root>
  );
}

export function ChipInputHook() {
  const field = useChipField({ initialChips: ['react'] });
  return (
    <Field.Root aria-label="Tags">
      <Field.ChipInput {...field.getChipInputProps()} placeholder="Add a tag" />
    </Field.Root>
  );
}

export function ChipInputCommitKeys() {
  const field = useChipField({ initialChips: ['one'] });
  return (
    <Field.Root aria-label="Tags">
      <Field.ChipInput {...field.getChipInputProps()} commitKeys={['Enter', ',']} placeholder="Enter or comma" />
    </Field.Root>
  );
}

function MaxRowsDemo({ density, maxRows }: { density: 'compact' | 'comfortable'; maxRows: 1 | 2 }) {
  const field = useChipField({ initialChips: MANY });
  return (
    <DensityProvider density={density}>
      <Field.Root aria-label="Tags" style={{ maxWidth: '18rem' }}>
        <Field.ChipInput {...field.getChipInputProps()} maxRows={maxRows} placeholder={`${density} maxRows=${maxRows}`} />
      </Field.Root>
    </DensityProvider>
  );
}

export function ChipInputMaxRows() {
  return (
    <>
      <MaxRowsDemo density="compact" maxRows={1} />
      <MaxRowsDemo density="compact" maxRows={2} />
      <MaxRowsDemo density="comfortable" maxRows={1} />
      <MaxRowsDemo density="comfortable" maxRows={2} />
    </>
  );
}

export function ChipInputLabel() {
  const tagsId = useId();
  const invalidId = useId();
  const field = useChipField({ initialChips: ['alpha'] });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={tagsId}>Tags</Label.Root>
        <Field.Root id={tagsId}>
          <Field.ChipInput {...field.getChipInputProps()} placeholder="Type and press Enter" />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={invalidId}>Tags</Label.Root>
        <Field.Root id={invalidId} invalid>
          <Field.ChipInput
            chips={['bad']}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>
      </Field.Group>
    </>
  );
}

export function CounterDefault() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
      <Field.Counter />
    </Field.Root>
  );
}

export function CounterInline() {
  const [value, setValue] = useState('Hello');
  const [note, setNote] = useState('Notes');
  return (
    <>
      <Field.Root aria-label="Username">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
      <Field.Root aria-label="Username">
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
      <Field.Root aria-label="Note">
        <Field.Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={80} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
      <Field.Root aria-label="Note">
        <Field.Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </Field.Root>
    </>
  );
}

export function CounterNarrow() {
  const [value, setValue] = useState('Hi');
  return (
    <div style={{ width: 160 }}>
      <Field.Root aria-label="Price">
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
        <Field.Counter style={{ flexBasis: 'auto' }} />
      </Field.Root>
    </div>
  );
}

export function CounterBefore() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.Counter />
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={20} />
    </Field.Root>
  );
}

export function CounterTextarea() {
  const [value, setValue] = useState('Notes');
  return (
    <Field.Root aria-label="Note">
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} maxLength={80} />
      <Field.Counter />
    </Field.Root>
  );
}

export function CounterOver() {
  const [value, setValue] = useState('Too long');
  return (
    <Field.Root aria-label="Code">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} maxLength={4} />
      <Field.Counter />
    </Field.Root>
  );
}

export function CounterPlain() {
  const [value, setValue] = useState('Hello');
  return (
    <Field.Root aria-label="Username">
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      <Field.Counter />
    </Field.Root>
  );
}

function attachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 8.5 9.5 5a2 2 0 0 1 3 3L7 13.5a3 3 0 0 1-4.5-4L8 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PromptComposer() {
  const [value, setValue] = useState('');
  return (
    <Composer.Root
      onSubmit={(event) => {
        event.preventDefault();
        setValue('');
      }}
    >
      <Field.Root aria-label="Message">
        <Field.Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoGrow
          maxRows={6}
          maxLength={280}
        />
        <Field.Row>
          <Button.Root variant="ghost" aria-label="Attach file">
            <Button.Icon>{attachIcon()}</Button.Icon>
          </Button.Root>
          <Field.Counter />
          <Composer.Submit disabled={value.trim() === ''} />
        </Field.Row>
      </Field.Root>
    </Composer.Root>
  );
}

export function RowComposer() {
  return <PromptComposer />;
}

export function RowComposerDensity() {
  return (
    <>
      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
        <DensityProvider key={density} density={density}>
          <PromptComposer />
        </DensityProvider>
      ))}
    </>
  );
}

function ChipRow({ density, chips }: { density: 'compact' | 'comfortable' | 'spacious'; chips: string[] }) {
  const id = useId();
  const field = useChipField({ initialChips: chips });
  return (
    <DensityProvider density={density}>
      <Field.Group>
        <Label.Root htmlFor={id}>Tags</Label.Root>
        <Field.Root id={id} style={{ maxWidth: '18rem' }}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.ChipInput {...field.getChipInputProps()} chipLayout="row" maxRows={2} placeholder="Tags" />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
    </DensityProvider>
  );
}

export function RowChipInput() {
  const emptyId = useId();
  const textId = useId();
  const empty = useChipField({ initialChips: [] });
  const [text, setText] = useState('');
  return (
    <>
      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
        <ChipRow key={density} density={density} chips={MANY} />
      ))}
      <Field.Group>
        <Label.Root htmlFor={emptyId}>Tags</Label.Root>
        <Field.Root id={emptyId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.ChipInput {...empty.getChipInputProps()} chipLayout="row" placeholder="No chips" />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={textId}>Tags</Label.Root>
        <Field.Root id={textId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.TextInput
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Same adornments"
          />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
    </>
  );
}

export function ChipInputStates() {
  return (
    <>
      <Field.Root aria-label="Locked tags" disabled>
        <Field.ChipInput
          chips={['locked']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
      <Field.Root aria-label="Invalid tags" invalid>
        <Field.ChipInput
          chips={['bad']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
    </>
  );
}

export function FieldSelectSize() {
  const id = useId();
  const [size, setSize] = useState('m');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Size</Label.Root>
      <Field.Root id={id}>
        <Field.Select value={size} onChange={(event) => setSize(event.target.value)}>
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
          <option value="xl" disabled>
            Extra large (sold out)
          </option>
        </Field.Select>
      </Field.Root>
    </Field.Group>
  );
}

export function FieldColorAccent() {
  const id = useId();
  const [color, setColor] = useState('#3366ff');
  const [text, setText] = useState(color);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Accent</Label.Root>
      <Field.Root id={id}>
        <Field.ColorPicker
          value={color}
          onValueChange={(next) => {
            setColor(next);
            setText(next);
          }}
        />
        <Field.TextInput
          value={text}
          onChange={() => undefined}
          onValueChange={(next) => {
            setText(next);
            const hex = normalizeHex(next);
            if (hex) setColor(hex);
          }}
          onBlur={() => setText(color)}
          spellCheck={false}
        />
      </Field.Root>
    </Field.Group>
  );
}

export function FieldNumber() {
  const id = useId();
  const [quantity, setQuantity] = useState('2');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Seats</Label.Root>
      <Field.Root id={id}>
        <Field.TextInput type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </Field.Root>
    </Field.Group>
  );
}

// The date and time demos start empty, so the server render needs no Temporal.
// The picker and the input share one state, so typing and picking stay in step.
export function FieldDatePicked() {
  const id = useId();
  const locale = useLocale();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start date</Label.Root>
      <Field.Root id={id} invalid={invalid}>
        <Field.TextInput
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDate(parseDate(event.target.value, { locale }));
            setInvalid(false);
          }}
          onBlur={() => {
            if (date) setText(formatDate(date, { locale }));
            else setInvalid(text.trim() !== '');
          }}
        />
        <Field.DatePicker
          value={date}
          onValueChange={(next) => {
            setDate(next);
            setText(formatDate(next, { locale }));
            setInvalid(false);
          }}
          locale={locale}
          showDate={false}
        />
      </Field.Root>
    </Field.Group>
  );
}

export function FieldDatePickerAlone() {
  const id = useId();
  const locale = useLocale();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Check-in</Label.Root>
      <Field.Root id={id}>
        <Field.DatePicker
          value={date}
          onValueChange={setDate}
          locale={locale}
          placeholder="Pick a date"
        />
      </Field.Root>
    </Field.Group>
  );
}

export function FieldTime() {
  const id = useId();
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Start time</Label.Root>
      <Field.Root id={id}>
        <Field.TimeInput step={900} value={time} onValueChange={setTime} />
      </Field.Root>
    </Field.Group>
  );
}

// A date and a time are two fields in one fieldset; the app joins them.
export function FieldDateAndTime() {
  const dateId = useId();
  const timeId = useId();
  const locale = useLocale();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  return (
    <Fieldset.Root>
      <Fieldset.Legend>Meeting starts</Fieldset.Legend>
      <Stack.Root direction="row">
        <Field.Group>
          <Label.Root htmlFor={dateId}>Date</Label.Root>
          <Field.Root id={dateId}>
            <Field.DatePicker value={date} onValueChange={setDate} locale={locale} placeholder="Pick a date" />
          </Field.Root>
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={timeId}>Time</Label.Root>
          <Field.Root id={timeId}>
            <Field.TimeInput step={900} value={time} onValueChange={setTime} />
          </Field.Root>
        </Field.Group>
      </Stack.Root>
    </Fieldset.Root>
  );
}

// A company control that is not a native input, joined to Field.Root with useField.
function Stars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const field = useField();
  const { disabled } = field;
  const step = (delta: number) => onChange(Math.min(5, Math.max(0, value + delta)));
  return (
    <span
      {...field.getControlProps({}, { native: false })}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={`${value} of 5 stars`}
      className="demo-stars"
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') step(1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') step(-1);
        else return;
        event.preventDefault();
      }}
    >
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

// A span is not labelable, so the caption names it through aria-labelledby.
export function FieldUseField() {
  const captionId = useId();
  const hintId = useId();
  const [stars, setStars] = useState(3);
  return (
    <Field.Group>
      <Text.Root as="span" id={captionId} size="s" weight="medium">
        Rating
      </Text.Root>
      <Field.Root aria-labelledby={captionId} aria-describedby={hintId}>
        <Stars value={stars} onChange={setStars} />
      </Field.Root>
      <Description.Root id={hintId}>Arrow keys change the rating.</Description.Root>
    </Field.Group>
  );
}
