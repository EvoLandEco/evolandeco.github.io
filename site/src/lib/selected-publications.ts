import data from "@/content-data/portfolio.json";

export const selectedPublications = data.publications.filter(
  (paper) => paper.authors[0]?.isOwner,
);
