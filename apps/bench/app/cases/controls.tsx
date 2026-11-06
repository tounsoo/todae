/** Choice and picking controls that work outside Field: radios, sliders, chips, lists, pickers. */
import {
  Calendar,
  Chip,
  ChipList,
  ColorPicker,
  defineMentionSource,
  Mention,
  OptionList,
  RadioGroup,
  Slider,
  ToggleGroup,
  type MentionSource,
} from '@tounsoo/todae';
import { useState } from 'react';
import { click, many, PAGE_SIZES, range, type CoverageGroup, type ItemProps } from './types.tsx';

const TAGS = ['design', 'tokens', 'accessibility', 'react', 'density'];

function RadioGroupItem({ index, tick }: ItemProps) {
  const [plan, setPlan] = useState<string | null>('free');
  return (
    <RadioGroup.Root aria-label={`Plan ${index} ${tick}`} value={plan} onValueChange={setPlan}>
      <RadioGroup.Item value="free">Free {`${tick}`}</RadioGroup.Item>
      <RadioGroup.Item value="pro">Pro {`${tick}`}</RadioGroup.Item>
      <RadioGroup.Item value="enterprise">Enterprise {`${tick}`}</RadioGroup.Item>
    </RadioGroup.Root>
  );
}

function SliderItem({ index, tick }: ItemProps) {
  const [value, setValue] = useState(40);
  return (
    <Slider.Root
      aria-label={`Volume ${index} ${tick}`}
      min={0}
      max={100}
      step={5}
      value={value}
      onChange={(event) => setValue(Number(event.target.value))}
    />
  );
}

function ColorPickerItem({ index, tick }: ItemProps) {
  const [color, setColor] = useState('#3366ff');
  return (
    <ColorPicker.Root aria-label={`Accent ${index} ${tick}`} value={color} onValueChange={setColor}>
      <ColorPicker.Area />
      <ColorPicker.Hue />
    </ColorPicker.Root>
  );
}

function CalendarItem({ index, tick }: ItemProps) {
  const [date, setDate] = useState<Temporal.PlainDate | null>(() => Temporal.PlainDate.from('2026-06-15'));
  return (
    <Calendar.Root aria-label={`Start date ${index} ${tick}`} locale="en-US" value={date} onValueChange={setDate}>
      <Calendar.Header />
      <Calendar.Grid />
    </Calendar.Root>
  );
}

function ChipListItem({ index, tick }: ItemProps) {
  const [chips, setChips] = useState(TAGS);
  return (
    <ChipList.Root
      aria-label={`Tags ${index} ${tick}`}
      chips={chips}
      maxRows={2}
      overflowLabel={(count) => `+${count} more ${tick}`}
      panelLabel={(count) => `${count} more tags`}
      onRemove={(at) => setChips((current) => current.filter((_, position) => position !== at))}
    />
  );
}

function OptionListItem({ index, tick }: ItemProps) {
  const [value, setValue] = useState<string | null>('pear');
  return (
    <OptionList.Root aria-label={`Fruit ${index} ${tick}`} value={value} onValueChange={setValue}>
      <OptionList.Option value="apple">{`Apple ${tick}`}</OptionList.Option>
      <OptionList.Option value="pear">{`Pear ${tick}`}</OptionList.Option>
      <OptionList.Option value="plum">{`Plum ${tick}`}</OptionList.Option>
    </OptionList.Root>
  );
}

function ToggleGroupItem({ index, tick }: ItemProps) {
  const [align, setAlign] = useState<string | null>('left');
  return (
    <ToggleGroup.Root aria-label={`Alignment ${index} ${tick}`} value={align} onValueChange={setAlign}>
      <ToggleGroup.Item value="left">Left {`${tick}`}</ToggleGroup.Item>
      <ToggleGroup.Item value="center">Center {`${tick}`}</ToggleGroup.Item>
      <ToggleGroup.Item value="right">Right {`${tick}`}</ToggleGroup.Item>
    </ToggleGroup.Root>
  );
}

type Person = { name: string };

const DIRECTORY: Record<string, Person> = {
  mina: { name: 'Mina Park' },
  minjun: { name: 'Min-jun Choi' },
  mira: { name: 'Mira Seo' },
};

// Made on first use, not at import, so a build that lacks defineMentionSource fails only this case.
let peopleSource: MentionSource<Person> | undefined;
const people = () =>
  (peopleSource ??= defineMentionSource<Person>({
    char: '@',
    label: 'People',
    options: Object.entries(DIRECTORY).map(([value, person]) => ({ value, label: person.name })),
    resolve: (id) => DIRECTORY[id],
    peekLabel: (person) => person.name,
    renderPeek: (person) => person.name,
  }));

/** A sent message that mentions someone, as a chat shows it. The peek opens on click. */
function MentionItem({ index, tick }: ItemProps) {
  return (
    <p>
      Message {index} {tick} for{' '}
      <Mention.Root source={people()} id="mina">
        @Mina Park
      </Mention.Root>
    </p>
  );
}

export const CONTROLS = {
  RadioGroup: [
    {
      id: 'radio-group',
      title: 'RadioGroup',
      Case: many(RadioGroupItem),
      interact: click('input[type="radio"]:not(:checked)'),
    },
  ],
  Slider: [
    {
      id: 'slider',
      title: 'Slider',
      Case: many(SliderItem),
    },
  ],
  ColorPicker: [
    {
      id: 'color-picker',
      title: 'ColorPicker',
      copies: [...PAGE_SIZES, 100],
      Case: many(ColorPickerItem),
    },
  ],
  Calendar: [
    {
      id: 'calendar',
      title: 'Calendar',
      copies: [...PAGE_SIZES, 100],
      Case: many(CalendarItem),
      interact: click('[role="gridcell"] button, td button'),
    },
  ],
  Chip: [
    {
      id: 'chip',
      title: 'Chip',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Chip.Root key={index} onRemove={() => undefined}>
              {`Tag ${index} ${tick}`}
            </Chip.Root>
          ))}
        </>
      ),
    },
  ],
  ChipList: [
    {
      id: 'chip-list',
      title: 'ChipList',
      Case: many(ChipListItem),
    },
  ],
  OptionList: [
    {
      id: 'option-list',
      title: 'OptionList',
      Case: many(OptionListItem),
      interact: click('[role="option"]'),
    },
  ],
  ToggleGroup: [
    {
      id: 'toggle-group',
      title: 'ToggleGroup',
      Case: many(ToggleGroupItem),
      interact: click('button:not([aria-pressed="true"])'),
    },
  ],
  Mention: [
    {
      id: 'mention',
      title: 'Mention',
      Case: many(MentionItem),
      // Opens the first mention's peek, which renders its card from the first open.
      interact: click('p button'),
    },
  ],
} satisfies CoverageGroup;
