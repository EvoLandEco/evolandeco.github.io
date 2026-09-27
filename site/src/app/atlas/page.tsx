import { AtlasRemote } from "@/components/atlas-remote";
export const metadata = {
  title: "ATLAS · Outbreak intelligence",
  description: "Explore outbreak reporting through time, geography and source evidence with ATLAS.",
  alternates: { canonical: "/atlas/" },
};
export default function AtlasPage() { return <AtlasRemote />; }
