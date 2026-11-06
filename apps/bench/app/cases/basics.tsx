/** Content and display parts: text, buttons, badges, cards, status and feedback. */
import { Badge, Button, Card, Text } from '@tounsoo/todae';
import { click, range, type CoverageGroup } from './types.tsx';

export const BASICS = {
  Button: [
    {
      id: 'button',
      title: 'Button',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Button.Root key={index}>
              Save {index} {tick}
            </Button.Root>
          ))}
        </>
      ),
      interact: click('button'),
    },
  ],
  Text: [
    {
      id: 'text-clamped',
      title: 'Text clamped to one line',
      Case: ({ copies, tick }) => (
        <div style={{ width: 160 }}>
          {range(copies).map((index) => (
            <Text.Root key={index} lines={1}>
              Invoice {index} for a customer with a long name, version {tick}
            </Text.Root>
          ))}
        </div>
      ),
    },
  ],
  Card: [
    {
      id: 'card-badge',
      title: 'Card with a Badge',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Card.Root key={index}>
              <Card.Body>
                Plan {index} <Badge.Root>New {tick}</Badge.Root>
              </Card.Body>
            </Card.Root>
          ))}
        </>
      ),
    },
  ],
} satisfies CoverageGroup;
