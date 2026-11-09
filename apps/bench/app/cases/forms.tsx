/** Field, its controls and sub-parts, and the form structure around them. */
import {
  Button,
  Calendar,
  Checkbox,
  ColorPicker,
  Description,
  ErrorMessage,
  Field,
  Fieldset,
  Form,
  Label,
  OptionList,
  Switch,
  timeOptions,
  type DateRange,
} from '@tounsoo/todae';
import { useId, useState } from 'react';
import { click, first, focus, many, PAGE_SIZES, range, type CoverageGroup, type ItemProps } from './types.tsx';

/** Sets a control's value the way typing does, so React's onChange fires. */
const type = (selector: string, text: string) => (container: HTMLElement) => {
  const element = first<HTMLInputElement | HTMLTextAreaElement>(container, selector);
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, text);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

function TextInputItem({ index, tick }: ItemProps) {
  const [value, setValue] = useState('');
  return (
    <Field.Root>
      <Field.TextInput aria-label={`Field ${index} ${tick}`} value={value} onValueChange={setValue} />
    </Field.Root>
  );
}

function NumberInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [quantity, setQuantity] = useState<number | null>(2);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Quantity {index} {tick}
      </Label.Root>
      <Field.Root id={id} name="quantity">
        <Field.Decrement />
        <Field.NumberInput value={quantity} onValueChange={setQuantity} min={1} max={99} locale="en" />
        <Field.Increment />
      </Field.Root>
    </Field.Group>
  );
}

function OneTimeCodeItem({ index, tick }: ItemProps) {
  const id = useId();
  const hintId = useId();
  const [code, setCode] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Verification code {index} {tick}
      </Label.Root>
      <Field.Root id={id} name="code" aria-describedby={hintId}>
        <Field.OneTimeCode value={code} onValueChange={setCode} />
      </Field.Root>
      <Description.Root id={hintId}>Enter the 6-digit code we sent.</Description.Root>
    </Field.Group>
  );
}

function TextareaItem({ index, tick }: ItemProps) {
  const id = useId();
  const [value, setValue] = useState('Notes');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Note {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
      </Field.Root>
    </Field.Group>
  );
}

function ChipInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Tags {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.ChipInput
          chips={chips}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          onCommit={(value) => {
            setChips((prev) => (prev.includes(value) ? prev : [...prev, value]));
            setInputValue('');
          }}
          onChipRemove={(position) => setChips((prev) => prev.filter((_, i) => i !== position))}
          placeholder="Type and press Enter"
        />
      </Field.Root>
    </Field.Group>
  );
}

function SelectItem({ index, tick }: ItemProps) {
  const id = useId();
  const [size, setSize] = useState('m');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Size {index} {tick}
      </Label.Root>
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

function Times({ value, onPick }: { value: Temporal.PlainTime | null; onPick: (time: Temporal.PlainTime) => void }) {
  return (
    <OptionList.Root aria-label="Times" value={value?.toString() ?? null} onValueChange={(next) => onPick(Temporal.PlainTime.from(next))}>
      {timeOptions({ step: 15, value, locale: 'en' }).map((option) => (
        <OptionList.Option key={option.value} value={option.value}>
          {option.label}
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}

function ColorPickerItem({ index, tick }: ItemProps) {
  const id = useId();
  const [color, setColor] = useState('#3366ff');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Accent {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.Picker swatch={color}>
          <ColorPicker.Root value={color} onValueChange={setColor}>
            <ColorPicker.Area />
            <ColorPicker.Hue />
          </ColorPicker.Root>
        </Field.Picker>
        <Field.TextInput value={color} onChange={() => undefined} spellCheck={false} />
      </Field.Root>
    </Field.Group>
  );
}

function DateInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [date, setDate] = useState<Temporal.PlainDate | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Start date {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.DateInput value={date} onValueChange={setDate} locale="en" />
        <Field.Picker>
          <Calendar.Root value={date} onValueChange={setDate} locale="en">
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}

function TimeInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [time, setTime] = useState<Temporal.PlainTime | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Start time {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.TimeInput value={time} onValueChange={setTime} locale="en" />
        <Field.Picker>
          <Times value={time} onPick={setTime} />
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}

function DateTimeInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [start, setStart] = useState<Temporal.PlainDateTime | null>(null);
  const [day, setDay] = useState<Temporal.PlainDate | null>(null);
  const date = start?.toPlainDate() ?? day;
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Meeting starts {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.DateTimeInput value={start} onValueChange={setStart} locale="en" />
        <Field.Picker closeOnPick={false}>
          {({ close }) => (
            <>
              <Calendar.Root
                value={date}
                onValueChange={(next) => (start ? setStart(next.toPlainDateTime(start.toPlainTime())) : setDay(next))}
                locale="en"
              >
                <Calendar.Header />
                <Calendar.Grid />
              </Calendar.Root>
              <Times
                value={start?.toPlainTime() ?? null}
                onPick={(time) => {
                  if (date) {
                    setStart(date.toPlainDateTime(time));
                    close();
                  }
                }}
              />
            </>
          )}
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}

function DateRangeInputItem({ index, tick }: ItemProps) {
  const id = useId();
  const [range, setRange] = useState<DateRange | null>(null);
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Stay {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.DateRangeInput value={range} onValueChange={setRange} locale="en" />
        <Field.Picker>
          <Calendar.Root mode="range" value={range} onValueChange={setRange} locale="en">
            <Calendar.Header />
            <Calendar.Grid />
          </Calendar.Root>
        </Field.Picker>
      </Field.Root>
    </Field.Group>
  );
}

function AdornmentsItem({ index, tick }: ItemProps) {
  const id = useId();
  const [search, setSearch] = useState('query');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Search {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.Icon>
          <span>⌕</span>
        </Field.Icon>
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} maxLength={40} />
        <Field.Counter />
      </Field.Root>
    </Field.Group>
  );
}

function ComposerItem({ index, tick }: ItemProps) {
  const id = useId();
  const [message, setMessage] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Message {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={280} autoGrow />
        <Field.Row>
          <Field.Affix>Markdown</Field.Affix>
          <Field.Counter style={{ marginInlineStart: 'auto' }} />
        </Field.Row>
      </Field.Root>
    </Field.Group>
  );
}

function FieldsetItem({ index, tick }: ItemProps) {
  const hintId = useId();
  const [topics, setTopics] = useState<string[]>(['product']);
  const toggle = (topic: string) => (checked: boolean) =>
    setTopics((prev) => (checked ? [...prev, topic] : prev.filter((t) => t !== topic)));
  return (
    <Fieldset.Root aria-describedby={hintId}>
      <Fieldset.Legend>
        Email topics {index} {tick}
      </Fieldset.Legend>
      <Description.Root id={hintId}>We send at most one email a week.</Description.Root>
      <Checkbox.Root checked={topics.includes('product')} onCheckedChange={toggle('product')}>
        Product news
      </Checkbox.Root>
      <Checkbox.Root checked={topics.includes('security')} onCheckedChange={toggle('security')}>
        Security notices
      </Checkbox.Root>
      <Checkbox.Root checked={topics.includes('events')} onCheckedChange={toggle('events')}>
        Events
      </Checkbox.Root>
    </Fieldset.Root>
  );
}

function FormItem({ index, tick }: ItemProps) {
  const nameId = useId();
  const emailId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <Form.Root onSubmit={(event) => event.preventDefault()}>
      <Form.Summary />
      <Field.Group>
        <Label.Root htmlFor={nameId}>Name</Label.Root>
        <Field.Root id={nameId} name="name">
          <Field.TextInput required minLength={2} value={name} onValueChange={setName} />
        </Field.Root>
        <ErrorMessage.Root />
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={emailId}>Work email</Label.Root>
        <Field.Root id={emailId} name="email">
          <Field.TextInput type="email" required value={email} onValueChange={setEmail} />
        </Field.Root>
        <ErrorMessage.Root />
      </Field.Group>
      <Button.Root type="submit">
        Create account {index} {tick}
      </Button.Root>
    </Form.Root>
  );
}

function LabelItem({ index, tick }: ItemProps) {
  const id = useId();
  const [value, setValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>
        Email {index} {tick}
      </Label.Root>
      <Field.Root id={id}>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
    </Field.Group>
  );
}

function DescriptionItem({ index, tick }: ItemProps) {
  const id = useId();
  const hintId = useId();
  const [value, setValue] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Work email</Label.Root>
      <Field.Root id={id} aria-describedby={hintId}>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      </Field.Root>
      <Description.Root id={hintId}>
        We only use this for billing receipts. {index} {tick}
      </Description.Root>
    </Field.Group>
  );
}

function ErrorMessageItem({ index, tick }: ItemProps) {
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('not-an-email');
  const invalid = email !== '' && !email.includes('@');
  return (
    <Field.Group>
      <Label.Root htmlFor={id}>Work email</Label.Root>
      <Field.Root id={id} invalid={invalid} aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}>
        <Field.TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field.Root>
      <Description.Root id={hintId}>We only use this for billing receipts.</Description.Root>
      {invalid ? (
        <ErrorMessage.Root id={errorId}>
          Enter an address that contains an @. {index} {tick}
        </ErrorMessage.Root>
      ) : null}
    </Field.Group>
  );
}

export const FORMS = {
  Checkbox: [
    {
      id: 'checkbox',
      title: 'Checkbox',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Checkbox.Root key={index}>
              Row {index} {tick}
            </Checkbox.Root>
          ))}
        </>
      ),
      interact: click('input[type="checkbox"]'),
    },
  ],
  Switch: [
    {
      id: 'switch',
      title: 'Switch',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Switch.Root key={index}>
              Alerts {index} {tick}
            </Switch.Root>
          ))}
        </>
      ),
      interact: click('input'),
    },
  ],
  'Field.TextInput': [
    {
      id: 'text-input',
      title: 'Field with TextInput',
      Case: many(TextInputItem),
      interact: focus('input'),
    },
  ],
  'Field.Root': { via: 'Field.TextInput' },
  Field: { via: 'Field.TextInput' },
  'Field.NumberInput': [
    {
      id: 'field-number-input',
      title: 'Field with NumberInput',
      Case: many(NumberInputItem),
      interact: click('button[aria-label^="Increase"]'),
    },
  ],
  'Field.Increment': { via: 'Field.NumberInput' },
  'Field.Decrement': { via: 'Field.NumberInput' },
  'Field.OneTimeCode': [
    {
      id: 'field-one-time-code',
      title: 'Field with OneTimeCode',
      Case: many(OneTimeCodeItem),
      interact: type('input', '123456'),
    },
  ],
  'Field.Textarea': [
    {
      id: 'field-textarea',
      title: 'Field with Textarea',
      Case: many(TextareaItem),
      interact: type('textarea', 'Notes for the team'),
    },
  ],
  'Field.ChipInput': [
    {
      id: 'field-chip-input',
      title: 'Field with ChipInput',
      Case: many(ChipInputItem),
      interact: type('input', 'gamma'),
    },
  ],
  'Field.Select': [
    {
      id: 'field-select',
      title: 'Field with Select',
      Case: many(SelectItem),
      interact: (container) => {
        const select = first<HTMLSelectElement>(container, 'select');
        select.value = 'l';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      },
    },
  ],
  'Field.Picker': [
    {
      id: 'field-picker-color',
      title: 'Field.Picker with a swatch and ColorPicker',
      Case: many(ColorPickerItem),
      interact: click('button[aria-haspopup]'),
    },
  ],
  'Field.DateInput': [
    {
      id: 'field-date-input',
      title: 'Field.DateInput with a Calendar picker',
      Case: many(DateInputItem),
      interact: click('button[aria-haspopup]'),
    },
  ],
  'Field.TimeInput': [
    {
      id: 'field-time-input',
      title: 'Field.TimeInput with a list of times',
      Case: many(TimeInputItem),
      interact: click('button[aria-haspopup]'),
    },
  ],
  'Field.DateTimeInput': [
    {
      id: 'field-date-time-input',
      title: 'Field.DateTimeInput with a Calendar and a list of times',
      Case: many(DateTimeInputItem),
      interact: click('button[aria-haspopup]'),
    },
  ],
  'Field.DateRangeInput': [
    {
      id: 'field-date-range-input',
      title: 'Field.DateRangeInput with a range Calendar',
      Case: many(DateRangeInputItem),
      interact: click('button[aria-haspopup]'),
    },
  ],
  'Field.Icon': [
    {
      id: 'field-adornments',
      title: 'Field with Icon, Affix and Counter',
      Case: many(AdornmentsItem),
      interact: type('input', 'search terms'),
    },
  ],
  'Field.Affix': { via: 'Field.Icon' },
  'Field.Counter': { via: 'Field.Icon' },
  'Field.Group': { via: 'Field.Icon' },
  'Field.Row': [
    {
      id: 'field-row',
      title: 'Field with a Row under a Textarea',
      Case: many(ComposerItem),
      interact: type('textarea', 'Shipping the release today'),
    },
  ],
  Fieldset: [
    {
      id: 'fieldset',
      title: 'Fieldset',
      Case: many(FieldsetItem),
      interact: click('input[type="checkbox"]'),
    },
  ],
  Form: [
    {
      id: 'form',
      title: 'Form',
      copies: PAGE_SIZES,
      Case: many(FormItem),
      interact: click('button[type="submit"]'),
    },
  ],
  Label: [
    {
      id: 'label',
      title: 'Label',
      Case: many(LabelItem),
      // A click on the label moves focus to its control.
      interact: click('label'),
    },
  ],
  Description: [
    {
      id: 'description',
      title: 'Description',
      Case: many(DescriptionItem),
    },
  ],
  ErrorMessage: [
    {
      id: 'error-message',
      title: 'ErrorMessage',
      Case: many(ErrorMessageItem),
      interact: type('input', 'ben@example.com'),
    },
  ],
} satisfies CoverageGroup;
