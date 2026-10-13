import { Code } from '@omsoo.design/todae/code';
import { Prose } from '@omsoo.design/todae/prose';

export function ProseArticle() {
  return (
    <Prose.Root>
      <h2>Release notes</h2>
      <p>
        This release adds a <Code.Root>prose</Code.Root> token group. Every gap below follows the density.
      </p>
      <ul>
        <li>Headings take their size from the prose tokens.</li>
        <li>Lists indent by one step.</li>
      </ul>
      <h3>Upgrading</h3>
      <p>Nothing to change. Pages that set their own spacing keep it.</p>
      <blockquote>
        <p>Quotes keep a rule at their start edge.</p>
      </blockquote>
    </Prose.Root>
  );
}
