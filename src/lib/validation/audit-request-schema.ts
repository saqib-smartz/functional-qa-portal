import { z } from "zod";

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const auditRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a page URL.")
    .refine(isHttpUrl, { message: "Enter a valid http(s) URL, e.g. https://example.com/about/" }),
  crawlBatchId: z.string().uuid().optional(),
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;
