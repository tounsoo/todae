import catalog from '@tounsoo/todae/catalog.json';

export function WhenToUse({ name, headingLevel = 2 }: { name: string; headingLevel?: 2 | 3 }) {
  const entry =
    catalog.components.find((row) => row.name === name) ?? catalog.patterns.find((row) => row.id === name);
  if (!entry) throw new Error(`Unknown catalog entry "${name}"`);
  const headingId = `when-to-use-${name.replaceAll('.', '-').toLowerCase()}`;
  const Title = headingLevel === 3 ? 'h3' : 'h2';
  const Subtitle = headingLevel === 3 ? 'h4' : 'h3';
  return (
    <section aria-labelledby={headingId}>
      <Title id={headingId}>When to use</Title>
      <ul>
        {entry.whenToUse.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {entry.whenNotToUse.length > 0 ? (
        <>
          <Subtitle>When not to use</Subtitle>
          <ul>
            {entry.whenNotToUse.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
