'use client';

import { DensityProvider, Description, ErrorMessage, Field, Label, ThemeProvider, useChipField } from '@tounsoo/todae';
import { useId, useState } from 'react';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

export function FieldStates() {
  const [value, setValue] = useState('');
  return (
    <>
      <Field.Root>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} placeholder="Idle" />
      </Field.Root>
      <Field.Root disabled>
        <Field.TextInput value="Disabled" onChange={() => undefined} />
      </Field.Root>
      <Field.Root invalid>
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
      <div className="labelled-field">
        <Label htmlFor={idleId}>Email</Label>
        <Field.Root id={idleId}>
          <Field.TextInput
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </Field.Root>
      </div>
      <div className="labelled-field">
        <Label htmlFor={disabledId}>Email</Label>
        <Field.Root id={disabledId} disabled>
          <Field.TextInput value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </div>
      <div className="labelled-field">
        <Label htmlFor={invalidId}>Email</Label>
        <Field.Root id={invalidId} invalid>
          <Field.TextInput value="Invalid" onChange={() => undefined} />
        </Field.Root>
      </div>
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
      <div className="labelled-field">
        <Label htmlFor={searchId}>Search</Label>
        <Field.Root id={searchId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field.Root>
      </div>
      <div className="labelled-field">
        <Label htmlFor={amountId}>Amount</Label>
        <Field.Root id={amountId}>
          <Field.Affix>$</Field.Affix>
          <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Field.Affix>USD</Field.Affix>
        </Field.Root>
      </div>
    </>
  );
}

export function FieldAdornments() {
  const [amount, setAmount] = useState('12');
  const [search, setSearch] = useState('query');
  return (
    <>
      <Field.Root>
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field.Affix>.00</Field.Affix>
      </Field.Root>
      <Field.Root>
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
    <Field.Root>
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
    </Field.Root>
  );
}

export function TextareaAutoGrow() {
  const [value, setValue] = useState('Grows up to six rows.');
  return (
    <Field.Root>
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} autoGrow maxRows={6} />
    </Field.Root>
  );
}

export function TextareaMaxRows() {
  const [value, setValue] = useState('maxRows only');
  return (
    <Field.Root>
      <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} maxRows={2} />
    </Field.Root>
  );
}

export function TextareaResize() {
  const [value, setValue] = useState('Drag between rows and maxRows.');
  return (
    <Field.Root>
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
          <Field.Root>
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
      <Field.Root>
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
      <div className="labelled-field">
        <Label htmlFor={id}>Note</Label>
        <Field.Root id={id} invalid={invalid} aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}>
          <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
        </Field.Root>
        <Description id={hintId}>A short description of the work.</Description>
        {invalid ? <ErrorMessage id={errorId}>Use at least 8 characters.</ErrorMessage> : null}
      </div>
      <div className="labelled-field">
        <Label htmlFor={disabledId}>Note</Label>
        <Field.Root id={disabledId} disabled>
          <Field.Textarea value="Disabled" onChange={() => undefined} />
        </Field.Root>
      </div>
    </>
  );
}

export function ChipInputControlled() {
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <Field.Root>
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
    <Field.Root>
      <Field.ChipInput {...field} placeholder="useChipField" />
    </Field.Root>
  );
}

export function ChipInputCommitKeys() {
  const field = useChipField({ initialChips: ['one'] });
  return (
    <Field.Root>
      <Field.ChipInput {...field} commitKeys={['Enter', ',']} placeholder="Enter or comma" />
    </Field.Root>
  );
}

function MaxRowsDemo({ density, maxRows }: { density: 'compact' | 'comfortable'; maxRows: 1 | 2 }) {
  const field = useChipField({ initialChips: MANY });
  return (
    <DensityProvider density={density}>
      <Field.Root style={{ maxWidth: '18rem' }}>
        <Field.ChipInput {...field} maxRows={maxRows} placeholder={`${density} maxRows=${maxRows}`} />
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
      <div className="labelled-field">
        <Label htmlFor={tagsId}>Tags</Label>
        <Field.Root id={tagsId}>
          <Field.ChipInput {...field} placeholder="Type and press Enter" />
        </Field.Root>
      </div>
      <div className="labelled-field">
        <Label htmlFor={invalidId}>Tags</Label>
        <Field.Root id={invalidId} invalid>
          <Field.ChipInput
            chips={['bad']}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>
      </div>
    </>
  );
}

export function ChipInputStates() {
  return (
    <>
      <Field.Root disabled>
        <Field.ChipInput
          chips={['locked']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
      <Field.Root invalid>
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
