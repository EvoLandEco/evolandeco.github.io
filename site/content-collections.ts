import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import remarkGfm from "remark-gfm";
import { z } from "zod";
const research = defineCollection({
  name: "research",
  directory: "content/research",
  include: "*.mdx",
  schema: z.object({ projectId: z.string(), content: z.string() }),
  transform: async (document, context) => ({
    ...document,
    mdx: await compileMDX(context, document, { remarkPlugins: [remarkGfm] }),
  }),
});
export default defineConfig({ content: [research] });
