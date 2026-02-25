export function getStateCodeFromElement(el) {
  let cur = el;
  while (cur && typeof cur.getAttribute === "function") {
    const id = cur.getAttribute("id") || cur.getAttribute("data-id");
    if (id && /^[A-Za-z]{2}$/.test(id)) return id.toUpperCase();
    const cls = cur.getAttribute("class");
    if (cls) {
      const token = cls.split(/\s+/).find((c) => /^[A-Za-z]{2}$/.test(c));
      if (token) return token.toUpperCase();
    }
    cur = cur.parentElement;
  }
  return null;
}
