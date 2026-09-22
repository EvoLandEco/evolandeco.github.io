import Link from "next/link";

export const metadata = { alternates: { canonical: "/" }, robots: { index: false } };
export default function About() {
  return <><meta httpEquiv="refresh" content="0;url=/" /><p><Link href="/">About Tianjian Qin</Link></p></>;
}
