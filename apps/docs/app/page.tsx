import { SITE_GROUPS } from '../components/siteGroups';

export default function HomePage() {
  return (
    <>
      <h1>Todae</h1>
      <p>What you need to do today. Components, hooks, recipes, and tokens.</p>
      {SITE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`home-${group.id}`}>
          <h2 id={`home-${group.id}`}>{group.label}</h2>
          <ul>
            {group.links.map(([href, label]) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
