import type { CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

const MAX_TEXT_LENGTH = 120;
const MAX_ATTR_VALUE_LENGTH = 80;
const LANDMARK_TAGS = new Set(["header", "footer", "nav", "main", "aside"]);

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function isElement(node: AnyNode | null): node is Element {
  return !!node && "tagName" in node;
}

/** `<header id="masthead" class="site-header">`-style shorthand for locating an ancestor. */
function describeContainer(el: Element): string {
  const id = el.attribs.id ? ` id="${el.attribs.id}"` : "";
  const cls = el.attribs.class
    ? ` class="${truncate(el.attribs.class.trim(), MAX_ATTR_VALUE_LENGTH)}"`
    : "";
  return `<${el.tagName.toLowerCase()}${id}${cls}>`;
}

/** Nearest landmark (header/footer/nav/main/aside), else the nearest ancestor with an id. */
function locate(el: Element): string | null {
  let withId: Element | null = null;
  for (let node = el.parent; isElement(node); node = node.parent) {
    const tag = node.tagName.toLowerCase();
    if (tag === "body" || tag === "html") break;
    if (LANDMARK_TAGS.has(tag)) return describeContainer(node);
    if (!withId && node.attribs.id) withId = node;
  }
  return withId ? describeContainer(withId) : null;
}

/**
 * One line per <h1> — its opening tag with attributes, its text, and where it sits — so each
 * one can be found in the theme/page builder and demoted.
 */
export function describeH1s($: CheerioAPI): string[] {
  return $("h1")
    .toArray()
    .map((el, i) => {
      const attrs = Object.entries(el.attribs)
        .map(([name, value]) =>
          value ? ` ${name}="${truncate(value, MAX_ATTR_VALUE_LENGTH)}"` : ` ${name}`,
        )
        .join("");
      const $el = $(el);
      let text = $el.text().trim().replace(/\s+/g, " ");
      if (!text) {
        const imgAlt = $el.find("img").first().attr("alt");
        text = imgAlt !== undefined ? `(no text — image alt="${imgAlt}")` : "(empty)";
      }
      const location = locate(el);
      return `#${i + 1}: <h1${attrs}>${truncate(text, MAX_TEXT_LENGTH)}</h1>${location ? ` — inside ${location}` : ""}`;
    });
}
