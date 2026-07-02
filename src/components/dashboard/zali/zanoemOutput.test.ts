import { describe, expect, it } from "vitest";
import { extractZanoemCodeFiles } from "./zanoemOutput";

describe("extractZanoemCodeFiles", () => {
  it("keeps explicit filenames from code_output JSON", () => {
    const files = extractZanoemCodeFiles([
      "```code_output",
      '{"files":[{"filename":"src/App.tsx","language":"tsx","content":"export default function App(){ return <div/> }"}]}',
      "```",
    ].join("\n"));

    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("src/App.tsx");
  });

  it("extracts a path label above a normal fenced code block so IDE preview can materialize it", () => {
    const files = extractZanoemCodeFiles([
      "**CODE**",
      "",
      "src/App.tsx",
      "```tsx",
      "export default function App() {",
      "  return <main>Hello</main>;",
      "}",
      "```",
      "",
      "src/index.css",
      "```css",
      "body { margin: 0; }",
      "```",
    ].join("\n"));

    expect(files.map((file) => file.filename)).toEqual(["src/App.tsx", "src/index.css"]);
    expect(files[0].content).toContain("export default function App");
  });

  it("falls back to snippet filenames when no path label exists", () => {
    const files = extractZanoemCodeFiles(["```ts", "export const answer = 42;", "```"].join("\n"));

    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("snippet-1.ts");
  });
});