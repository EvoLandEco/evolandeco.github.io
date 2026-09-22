import Link from "next/link";
export default function NotFound() {
  return (
    <section className="surface">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>This address does not point to a public page.</p>
      <Link className="button primary" href="/">
        Back to Home
      </Link>
    </section>
  );
}
