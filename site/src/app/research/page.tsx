import { SectionHeading } from "@/components/portfolio-sections";
import { Approach } from "@/components/visuals";
import { Programmes } from "@/components/programmes";
export const metadata = {
  title: "Research",
  description:
    "Evolutionary inference, temporal networks, epidemiology and research software.",
  alternates: { canonical: "/research" },
};
export default function Research() {
  return (
    <>
      <section className="surface research-intro">
        <h1 className="sr-only">Research</h1>
        <Approach />
      </section>
      <section className="surface">
        <SectionHeading label="Working together" title="Programmes & collaborations" />
        <Programmes />
      </section>
    </>
  );
}
