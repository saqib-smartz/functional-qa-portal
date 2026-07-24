export interface ThemeFingerprint {
  slug: string;
  name: string;
  /** matched against raw page HTML */
  match: (html: string) => boolean;
}

export const WORDPRESS_THEMES: ThemeFingerprint[] = [
  { slug: "kadence", name: "Kadence", match: (html) => /wp-content\/themes\/kadence\b/i.test(html) },
  { slug: "astra", name: "Astra", match: (html) => /wp-content\/themes\/astra\b/i.test(html) },
  {
    slug: "generatepress",
    name: "GeneratePress",
    match: (html) => /wp-content\/themes\/generatepress\b/i.test(html),
  },
  { slug: "blocksy", name: "Blocksy", match: (html) => /wp-content\/themes\/blocksy\b/i.test(html) },
  {
    slug: "hello-elementor",
    name: "Hello Elementor",
    match: (html) => /wp-content\/themes\/hello-elementor\b/i.test(html),
  },
  {
    slug: "twentytwentysix",
    name: "Twenty Twenty-Six",
    match: (html) => /wp-content\/themes\/twentytwentysix\b/i.test(html),
  },
  {
    slug: "twentytwentyfive",
    name: "Twenty Twenty-Five",
    match: (html) => /wp-content\/themes\/twentytwentyfive\b/i.test(html),
  },
  {
    slug: "twentytwentyfour",
    name: "Twenty Twenty-Four",
    match: (html) => /wp-content\/themes\/twentytwentyfour\b/i.test(html),
  },
];

/** Falls back to parsing any `wp-content/themes/<slug>` path even if it's not in the known list. */
export function detectTheme(html: string): { theme?: string; confidence?: "high" | "medium" | "low" } {
  for (const theme of WORDPRESS_THEMES) {
    if (theme.match(html)) {
      return { theme: theme.name, confidence: "high" };
    }
  }

  const genericMatch = html.match(/wp-content\/themes\/([a-z0-9-_]+)/i);
  if (genericMatch) {
    return { theme: genericMatch[1], confidence: "medium" };
  }

  return {};
}
