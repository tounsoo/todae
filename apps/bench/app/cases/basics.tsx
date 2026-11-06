/** Content and display parts: text, buttons, badges, cards, status and feedback. */
import { useState } from "react";
import {
  Alert,
  Attachment,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Code,
  CodeBlock,
  DataList,
  defineMentionSource,
  type MentionSource,
  EmptyState,
  Kbd,
  Link,
  Loader,
  MentionText,
  Message,
  Meter,
  Pagination,
  Progress,
  Prose,
  Separator,
  Skeleton,
  Steps,
  Text,
  VisuallyHidden,
} from "@tounsoo/todae";
import {
  click,
  many,
  PAGE_SIZES,
  range,
  type CoverageGroup,
  type ItemProps,
} from "./types.tsx";

function AlertItem({ index, tick }: ItemProps) {
  const [shown, setShown] = useState(true);
  if (!shown) return <></>;
  return (
    <Alert.Root tone="warning" role="none">
      <Alert.Title>
        Storage almost full {index} {tick}
      </Alert.Title>
      <Alert.Description>Free up space or upgrade your plan.</Alert.Description>
      <Alert.Close onClick={() => setShown(false)} />
    </Alert.Root>
  );
}

function AttachmentItem({ index, tick }: ItemProps) {
  const [removed, setRemoved] = useState(false);
  if (removed) return <></>;
  return (
    <Attachment.Root status="uploading">
      <Attachment.Name>{`report-${index}-${tick}.pdf`}</Attachment.Name>
      <Attachment.Meta>2.4 MB</Attachment.Meta>
      <Attachment.Progress value={40} max={100} />
      <Attachment.Remove onClick={() => setRemoved(true)} />
    </Attachment.Root>
  );
}

// Made on first use, not at import, so a build that lacks defineMentionSource fails only this case.
let peopleSource: MentionSource | undefined;
const people = () => (peopleSource ??= defineMentionSource({
  char: "@",
  options: [
    { value: "ada", label: "Ada Lovelace" },
    { value: "grace", label: "Grace Hopper" },
  ],
}));

const MENTION_TEXT = "Ask @Ada Lovelace and @Grace Hopper to review";
const mentionDraft = {
  text: MENTION_TEXT,
  tokens: [
    { start: 4, end: 17, char: "@", value: "ada", text: "@Ada Lovelace" },
    { start: 22, end: 35, char: "@", value: "grace", text: "@Grace Hopper" },
  ],
};

function PaginationCase({ tick }: { tick: number }) {
  const [page, setPage] = useState(1);
  return (
    <Pagination.Root>
      <Pagination.Item>
        <Button.Root
          onClick={() => setPage(page - 1)}
          aria-disabled={page === 1}
        >
          Previous {tick}
        </Button.Root>
      </Pagination.Item>
      {[1, 2, 3].map((number) => (
        <Pagination.Item key={number}>
          <Button.Root
            aria-current={number === page ? "page" : undefined}
            onClick={() => setPage(number)}
          >
            {number}
          </Button.Root>
        </Pagination.Item>
      ))}
      <Pagination.Ellipsis />
      <Pagination.Item>
        <Button.Root onClick={() => setPage(page + 1)}>Next</Button.Root>
      </Pagination.Item>
    </Pagination.Root>
  );
}

export const BASICS = {
  Button: [
    {
      id: "button",
      title: "Button",
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Button.Root key={index}>
              Save {index} {tick}
            </Button.Root>
          ))}
        </>
      ),
      interact: click("button"),
    },
  ],
  Text: [
    {
      id: "text-clamped",
      title: "Text clamped to one line",
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
      id: "card-badge",
      title: "Card with a Badge",
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
  Alert: [
    {
      id: "alert",
      title: "Alert",
      Case: many(AlertItem),
      interact: click("button"),
    },
  ],
  Attachment: [
    {
      id: "attachment",
      title: "Attachment uploading",
      Case: many(AttachmentItem),
      interact: click("button"),
    },
  ],
  Avatar: [
    {
      id: "avatar",
      title: "Avatar with initials",
      Case: many(({ index, tick }) => (
        <Avatar.Root label={`Ada Lovelace ${index}`} tone="neutral">
          <Avatar.Fallback>AL{tick}</Avatar.Fallback>
        </Avatar.Root>
      )),
    },
  ],
  Badge: [
    {
      id: "badge",
      title: "Badge",
      Case: many(({ index, tick }) => (
        <Badge.Root>
          Beta {index} {tick}
        </Badge.Root>
      )),
    },
  ],
  Breadcrumbs: [
    {
      id: "breadcrumbs",
      title: "Breadcrumbs",
      copies: PAGE_SIZES,
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Breadcrumbs.Root key={index}>
              <Breadcrumbs.Item>
                <Link.Root href="/">Home {tick}</Link.Root>
              </Breadcrumbs.Item>
              <Breadcrumbs.Item>
                <Link.Root href="/settings">Settings</Link.Root>
              </Breadcrumbs.Item>
              <Breadcrumbs.Item current>Billing {index}</Breadcrumbs.Item>
            </Breadcrumbs.Root>
          ))}
        </>
      ),
    },
  ],
  Code: [
    {
      id: "code",
      title: "Inline Code",
      Case: many(({ index, tick }) => (
        <Text.Root>
          Run{" "}
          <Code.Root>
            pnpm build {index} {tick}
          </Code.Root>{" "}
          first.
        </Text.Root>
      )),
    },
  ],
  CodeBlock: [
    {
      id: "code-block",
      title: "CodeBlock",
      copies: PAGE_SIZES,
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <CodeBlock.Root key={index}>
              <code>
                {`import { Button } from '@tounsoo/todae';\n\nexport const Save = () => <Button.Root>Save ${index} ${tick}</Button.Root>;`}
              </code>
            </CodeBlock.Root>
          ))}
        </>
      ),
    },
  ],
  DataList: [
    {
      id: "data-list",
      title: "DataList rows",
      Case: ({ copies, tick }) => (
        <DataList.Root>
          {range(copies).map((index) => (
            <DataList.Item key={index}>
              <DataList.Term>Order {index}</DataList.Term>
              <DataList.Details>Shipped {tick}</DataList.Details>
            </DataList.Item>
          ))}
        </DataList.Root>
      ),
    },
  ],
  EmptyState: [
    {
      id: "empty-state",
      title: "EmptyState",
      copies: PAGE_SIZES,
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <EmptyState.Root key={index}>
              <EmptyState.Icon>
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </EmptyState.Icon>
              <EmptyState.Title>
                No results {index} {tick}
              </EmptyState.Title>
              <EmptyState.Description>
                Try a different search term or clear the filters.
              </EmptyState.Description>
              <EmptyState.Actions>
                <Button.Root>Clear filters</Button.Root>
              </EmptyState.Actions>
            </EmptyState.Root>
          ))}
        </>
      ),
    },
  ],
  Kbd: [
    {
      id: "kbd",
      title: "Kbd shortcut",
      Case: many(({ index, tick }) => (
        <Kbd.Root>
          <Kbd.Root>⌘</Kbd.Root>
          <Kbd.Root>K</Kbd.Root> {index} {tick}
        </Kbd.Root>
      )),
    },
  ],
  Link: [
    {
      id: "link",
      title: "Link",
      Case: many(({ index, tick }) => (
        <Link.Root href={`#item-${index}`}>
          Read more {index} {tick}
        </Link.Root>
      )),
    },
  ],
  Loader: [
    {
      id: "loader",
      title: "Loader spinner",
      Case: many(({ index, tick }) => (
        <label>
          Loading {index} {tick} <Loader.Root />
        </label>
      )),
    },
  ],
  Message: [
    {
      id: "message",
      title: "Message",
      Case: many(({ index, tick }) => (
        <Message.Root
          from={index % 2 ? "user" : "assistant"}
          aria-label={index % 2 ? "You" : "Assistant"}
        >
          <Message.Header>
            Assistant{" "}
            <Message.Time
              value={Temporal.ZonedDateTime.from(
                "2026-10-14T09:41:00+00:00[UTC]",
              )}
              locale="en-US"
            />
          </Message.Header>
          <Message.Content>
            Reply {index} at {tick}
          </Message.Content>
        </Message.Root>
      )),
    },
  ],
  MentionText: [
    {
      id: "mention-text",
      title: "MentionText",
      Case: many(({ index, tick }) => (
        <>
          {index} {tick} <MentionText value={mentionDraft} sources={[people()]} />
        </>
      )),
    },
  ],
  Meter: [
    {
      id: "meter",
      title: "Meter",
      Case: many(({ index, tick }) => (
        <label>
          Storage {index} {tick} <Meter.Root value={70} min={0} max={100} />
        </label>
      )),
    },
  ],
  Pagination: [
    {
      id: "pagination",
      title: "Pagination",
      copies: PAGE_SIZES,
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <PaginationCase key={index} tick={tick} />
          ))}
        </>
      ),
      interact: click("ol li:nth-child(3) button"),
    },
  ],
  Progress: [
    {
      id: "progress",
      title: "Progress",
      Case: many(({ index, tick }) => (
        <label>
          Upload {index} {tick} <Progress.Root value={40} max={100} />
        </label>
      )),
    },
  ],
  Prose: [
    {
      id: "prose",
      title: "Prose article",
      copies: PAGE_SIZES,
      Case: ({ copies, tick }) => (
        <>
          {range(copies).map((index) => (
            <Prose.Root key={index}>
              <h2>
                Release notes {index} {tick}
              </h2>
              <p>
                This release adds <strong>faster</strong> builds and a{" "}
                <a href="#notes">new report</a>.
              </p>
              <ul>
                <li>Smaller bundles</li>
                <li>Clearer errors</li>
              </ul>
            </Prose.Root>
          ))}
        </>
      ),
    },
  ],
  Separator: [
    {
      id: "separator",
      title: "Separator",
      Case: many(({ index, tick }) => (
        <div>
          Section {index} {tick}
          <Separator.Root />
        </div>
      )),
    },
  ],
  Skeleton: [
    {
      id: "skeleton",
      title: "Skeleton",
      Case: many(({ index, tick }) => (
        <Skeleton.Root
          aria-label={`Loading ${index} ${tick}`}
          style={{ height: 16 }}
        />
      )),
    },
  ],
  Steps: [
    {
      id: "steps",
      title: "Steps",
      Case: ({ copies, tick }) => (
        <Steps.Root>
          {range(copies).map((index) => (
            <Steps.Item
              key={index}
              status={
                index === 0 ? "done" : index === 1 ? "current" : "pending"
              }
            >
              Step {index} {tick}
            </Steps.Item>
          ))}
        </Steps.Root>
      ),
    },
  ],
  VisuallyHidden: [
    {
      id: "visually-hidden",
      title: "VisuallyHidden",
      Case: many(({ index, tick }) => (
        <Button.Root>
          <VisuallyHidden.Root>
            Delete item {index} {tick}
          </VisuallyHidden.Root>
          ×
        </Button.Root>
      )),
    },
  ],
} satisfies CoverageGroup;
