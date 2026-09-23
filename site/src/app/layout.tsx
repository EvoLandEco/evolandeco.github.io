import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionPolicy, Settings } from "@/components/motion-policy";
import { ContactSection, NetworkBackdrop } from "@/components/portfolio-sections";
import Navbar from "@/components/navbar";
import data from "@/content-data/portfolio.json";
import "./globals.css";
const p = data.profile;
const analyticsToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN;
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || p.siteUrl),
  title: {
    default: "Tianjian Qin · Computational Biology",
    template: "%s · Tianjian Qin",
  },
  description: p.intro,
  openGraph: {
    type: "website",
    siteName: p.name,
    images: ["/art/evolutionary-inference-refined.webp"],
  },
  robots: { index: process.env.SITE_INDEXABLE === "true", follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: p.name,
              url: p.siteUrl,
              jobTitle: p.role,
              affiliation: { "@type": "Organization", name: p.affiliation },
              sameAs: p.links
                .filter((l) => l.url.startsWith("https:"))
                .map((l) => l.url),
            }).replace(/</g, "\\u003c"),
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionPolicy>
            <a className="skip" href="#main">
              Skip to content
            </a>
            <NetworkBackdrop className="top-network" />
            <div className="site-shell">
              <div className="main-column">
                <Navbar />
                <main id="main">{children}<ContactSection /></main>
                <footer>
                  <span>© 2026 Tianjian Qin</span>
                  <p className="footer-credit">
                    Powered by <a href="https://magicui.design/">Magic UI</a>, built by GPT-6 Astra.
                  </p>
                </footer>
              </div>
            </div>
            {process.env.NEXT_PUBLIC_SHOW_APPEARANCE !== "false" && <aside aria-label="Appearance"><Settings /></aside>}
          </MotionPolicy>
        </ThemeProvider>
        {analyticsToken && (
          <script defer src="/analytics.js"
            data-token={analyticsToken}
            data-hostname={new URL(process.env.SITE_ORIGIN || p.siteUrl).hostname} />
        )}
      </body>
    </html>
  );
}
