export interface PluginFingerprint {
  slug: string;
  name: string;
  match: (html: string) => boolean;
}

export const WORDPRESS_PLUGINS: PluginFingerprint[] = [
  {
    slug: "woocommerce",
    name: "WooCommerce",
    match: (html) => /wp-content\/plugins\/woocommerce\b/i.test(html) || /\bwoocommerce\b/i.test(html),
  },
  {
    slug: "elementor",
    name: "Elementor",
    match: (html) => /wp-content\/plugins\/elementor\b/i.test(html) || /\belementor-\w/i.test(html),
  },
  {
    slug: "kadence-blocks",
    name: "Kadence Blocks",
    match: (html) => /wp-content\/plugins\/kadence-blocks\b/i.test(html) || /\bkadence-blocks\b/i.test(html),
  },
  {
    slug: "yoast-seo",
    name: "Yoast SEO",
    match: (html) =>
      /wp-content\/plugins\/wordpress-seo\b/i.test(html) || /generator["']\s+content=["']Yoast SEO/i.test(html),
  },
  {
    slug: "rank-math",
    name: "Rank Math",
    match: (html) => /wp-content\/plugins\/seo-by-rank-math\b/i.test(html) || /rank math/i.test(html),
  },
  {
    slug: "contact-form-7",
    name: "Contact Form 7",
    match: (html) => /wp-content\/plugins\/contact-form-7\b/i.test(html) || /\bwpcf7\b/i.test(html),
  },
  {
    slug: "wpforms",
    name: "WPForms",
    match: (html) => /wp-content\/plugins\/wpforms(-lite)?\b/i.test(html) || /\bwpforms-form\b/i.test(html),
  },
  {
    slug: "gravity-forms",
    name: "Gravity Forms",
    match: (html) => /wp-content\/plugins\/gravityforms\b/i.test(html) || /\bgform_wrapper\b/i.test(html),
  },
  {
    slug: "fluent-forms",
    name: "Fluent Forms",
    match: (html) => /wp-content\/plugins\/fluentform\b/i.test(html) || /\bfluentform\b/i.test(html),
  },
  {
    slug: "litespeed-cache",
    name: "LiteSpeed Cache",
    match: (html) => /wp-content\/plugins\/litespeed-cache\b/i.test(html) || /litespeed/i.test(html),
  },
  {
    slug: "wp-rocket",
    name: "WP Rocket",
    match: (html) => /wp-content\/plugins\/wp-rocket\b/i.test(html) || /\bwpr-\w+/i.test(html),
  },
];

export function detectPlugins(html: string): string[] {
  return WORDPRESS_PLUGINS.filter((plugin) => plugin.match(html)).map((plugin) => plugin.name);
}

export function detectIsWordPress(html: string): boolean {
  return (
    /wp-content\//i.test(html) ||
    /wp-includes\//i.test(html) ||
    /generator["']\s+content=["']WordPress/i.test(html)
  );
}

export function detectGenerator(html: string): string | undefined {
  const match = html.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i);
  return match?.[1];
}
