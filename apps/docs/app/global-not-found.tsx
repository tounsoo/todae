import { SiteShell } from '../components/SiteShell';

export const metadata = { title: 'Todae' };

// Each locale has its own root layout, so a URL that matches none of them renders this.
export default function GlobalNotFound() {
  return (
    <SiteShell locale="en">
      <h1>Page not found</h1>
      <p>
        <a href="/">Todae home</a>
      </p>
    </SiteShell>
  );
}
