export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // remove non-alphanum
    .replace(/\s+/g, "-");         // spaces -> hyphens
