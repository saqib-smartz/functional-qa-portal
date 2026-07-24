import { z } from "zod";

export const auditRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a page URL.")
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Enter a valid http(s) URL, e.g. https://example.com/about/" },
    ),
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;
