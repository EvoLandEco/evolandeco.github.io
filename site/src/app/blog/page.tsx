import { BlogNotebook } from "@/components/blog-notebook";

export const metadata = {
  title: "Blog",
  description: "Notes on development, networks, machine learning and evolution.",
  alternates: { canonical: "/blog" },
};

export default function Blog() {
  return <BlogNotebook />;
}
