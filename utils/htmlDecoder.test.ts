import { describe, it, expect } from "bun:test";
import { decodeHtml } from "./htmlDecoder";

describe("decodeHtml", () => {
  // 1. Basic Input Handling
  describe("Basic Input Handling", () => {
    it("returns empty string for null", () => {
      expect(decodeHtml(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(decodeHtml(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(decodeHtml("")).toBe("");
    });

    it("trims whitespace", () => {
      expect(decodeHtml("   ")).toBe("");
      expect(decodeHtml("  hello  ")).toBe("hello");
    });
  });

  // 2. Quote Stripping
  describe("Quote Stripping", () => {
    it("removes surrounding double quotes", () => {
      expect(decodeHtml('"content"')).toBe("content");
      expect(decodeHtml('"hello world"')).toBe("hello world");
    });

    it("keeps quotes if not surrounding both ends", () => {
      expect(decodeHtml('"hello')).toBe('"hello');
      expect(decodeHtml('hello"')).toBe('hello"');
    });

    it("handles quoted base64 string", () => {
      // "SGVsbG8=" -> Hello
      expect(decodeHtml('"SGVsbG8="')).toBe("Hello");
    });
  });

  // 3. Base64 Decoding (Data URI)
  describe("Base64 Decoding (Data URI)", () => {
    it("decodes valid Data URI base64 HTML", () => {
      // <h1>Hello</h1> -> PGgxPkhlbGxvPC9oMT4=
      const base64 = "PGgxPkhlbGxvPC9oMT4=";
      const input = `data:text/html;base64,${base64}`;
      expect(decodeHtml(input)).toBe("<h1>Hello</h1>");
    });

    it("handles invalid Data URI gracefully", () => {
      // Missing comma or malformed part
      const input = "data:text/html;base64INVALID";
      // Should probably return original if split fails or return part if catch block triggers
      // Wait, code splits by ',', takes [1]. If comma missing, split gives array length 1, [1] is undefined.
      // atob(undefined) throws. Catch block catches. Returns processed (original string).
      expect(decodeHtml(input)).toBe(input);
    });
  });

  // 4. Base64 Decoding (Raw)
  describe("Base64 Decoding (Raw)", () => {
    it("decodes raw base64 string", () => {
      // <h1>Hello</h1> -> PGgxPkhlbGxvPC9oMT4=
      const input = "PGgxPkhlbGxvPC9oMT4=";
      expect(decodeHtml(input)).toBe("<h1>Hello</h1>");
    });

    it("decodes raw base64 with unicode characters", () => {
      // "你好" -> 5L2g5aW9
      // atob("5L2g5aW9") -> raw bytes
      // decodeURIComponent(escape(raw)) -> "你好"
      const input = "5L2g5aW9";
      expect(decodeHtml(input)).toBe("你好");
    });

    it("ignores invalid base64 strings (returns original)", () => {
      // Contains invalid char %
      const input = "InvalidBase64%%";
      expect(decodeHtml(input)).toBe(input);
    });

    it("ignores base64 that decodes to non-HTML/meaningful text", () => {
        // If decoded string is empty or just whitespace, code might skip update?
        // Code: if (decoded.includes('<') || decoded.includes(' ') || decoded.length > 0)
        // length > 0 is very permissive. So almost anything decodable is accepted.
        // Let's test empty decoded result?
        // atob("") -> "" -> length 0 -> condition fails -> returns original "" (which is trimmed empty anyway)

        // Test something that looks like base64 but decodes to garbage that technically has length > 0
        // "YWJj" -> "abc" -> accepted
        expect(decodeHtml("YWJj")).toBe("abc");
    });
  });

  // 5. HTML Entity Decoding (SSR fallback path)
  describe("HTML Entity Decoding", () => {
    it("decodes standard HTML entities (&lt;, &gt;, &amp;, &quot;)", () => {
      const input = "&lt;h1&gt;Title &amp; &quot;Quote&quot;&lt;/h1&gt;";
      const expected = '<h1>Title & "Quote"</h1>';
      expect(decodeHtml(input)).toBe(expected);
    });

    it("decodes &#39; to single quote", () => {
      const input = "It&#39;s me";
      const expected = "It's me";
      expect(decodeHtml(input)).toBe(expected);
    });

    it("handles mixed content with entities", () => {
      const input = "Just some text with &lt;b&gt;bold&lt;/b&gt;.";
      const expected = "Just some text with <b>bold</b>.";
      expect(decodeHtml(input)).toBe(expected);
    });

    it("handles recursive entity decoding (up to limit)", () => {
        // Code: if (unescaped !== processed) { processed = unescaped; }
        // The recursion limit mentioned in comment "Recursion limit 2" is implemented as:
        // checks entities -> unescapes -> checks if changed -> updates processed.
        // It doesn't seem to loop, just one pass?
        // Wait, let's re-read code:
        /*
          try {
              const textarea = document.createElement('textarea');
              textarea.innerHTML = processed;
              const unescaped = textarea.value;

              // Double check: if unescaping reveals MORE entities, do it again? (Recursion limit 2)
              if (unescaped !== processed) {
                 processed = unescaped;
              }
          } catch (e) { ... }
        */
        // The catch block (fallback) does NOT loop. It just does replace() chains once.
        // So in SSR (test env), &amp;lt; -> &lt; (one pass).
        // &lt; -> <
        // But replace chain: .replace(/&lt;/g, '<')...
        // If input is "&amp;lt;", &amp; becomes &. Result "&lt;".
        // Does it re-run? No.

        // In browser (try block), it sets innerHTML. Browser might handle some recursion or valid HTML.
        // The comment says "Recursion limit 2" but code just does `if (unescaped !== processed) processed = unescaped`.
        // This looks like it just accepts the unescaped value. It doesn't loop.

        // SSR Fallback test:
        // &amp;lt; -> &lt; (because &amp; -> &)
        // Wait, replacements happen sequentially in chain:
        /*
          processed = processed
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
        */
        // If input is "&amp;lt;",
        // 1. &lt; -> < (no match yet)
        // 3. &amp; -> & (matches) -> Result "&lt;"
        // So output is "&lt;".

        // If the order was reversed or if it looped, it might become "<".
        // Let's test this behavior to document it.
        const input = "&amp;lt;";
        // In fallback: &amp; -> &. &lt; is NOT replaced because it wasn't there initially?
        // Actually replace chain runs on the result of previous replace.
        // 1. replace(/&lt;/g, '<') -> "&amp;lt;" (no change)
        // ...
        // 3. replace(/&amp;/g, '&') -> "&lt;"
        // So output is "&lt;".

        expect(decodeHtml("&amp;lt;")).toBe("&lt;");
    });
  });

});
