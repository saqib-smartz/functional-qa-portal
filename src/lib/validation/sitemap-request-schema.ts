import { z } from "zod";

export const sitemapParseRequestSchema = z.object({
  xml: z
    .string()
    .min(1, "Upload a sitemap XML file.")
    .max(10_000_000, "Sitemap file is too large (10MB max)."),
});

export type SitemapParseRequest = z.infer<typeof sitemapParseRequestSchema>;
