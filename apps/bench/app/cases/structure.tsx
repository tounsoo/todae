/** Layout, navigation and data parts, and the providers an app wraps them in. */
import { Tabs } from '@tounsoo/todae';
import { range, type CoverageGroup } from './types.tsx';

export const STRUCTURE = {
  Tabs: [
    {
      id: 'tabs',
      title: 'Tabs with three panels',
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Tabs.Root key={index} defaultValue="a">
              <Tabs.List aria-label={`Tabs ${index}`}>
                <Tabs.Tab value="a">Overview {tick}</Tabs.Tab>
                <Tabs.Tab value="b">Activity</Tabs.Tab>
                <Tabs.Tab value="c">Settings</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="a">Overview {index}</Tabs.Panel>
              <Tabs.Panel value="b">Activity {index}</Tabs.Panel>
              <Tabs.Panel value="c">Settings {index}</Tabs.Panel>
            </Tabs.Root>
          ))}
        </>
      ),
      interact: (container) => {
        const tabs = container.querySelectorAll<HTMLElement>('[role="tab"]');
        const second = tabs[1];
        if (!second) throw new Error('no second tab');
        second.click();
      },
    },
  ],
} satisfies CoverageGroup;
