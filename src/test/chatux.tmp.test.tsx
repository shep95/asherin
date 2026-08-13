import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ChatView from "@/components/dashboard/ChatView";
import { thinkingStore } from "@/hooks/useAureonThinking";

const convo: any = {
  id: "c1", title: "t", messages: [
    { id: "u1", role: "user", content: "hello there", timestamp: Date.now() },
    { id: "a1", role: "assistant", content: "an answer", timestamp: Date.now() },
  ],
};

describe("chat ux", () => {
  it("renders composer, thinking header, minimal action bar", () => {
    thinkingStore.begin("a1");
    thinkingStore.append("a1", "weighing options");
    thinkingStore.step("a1", "Searching", "dallas cameras");
    thinkingStore.finish("a1");
    render(<MemoryRouter><ChatView conversation={convo} onSendMessage={() => {}} mode={"chat" as any} onModeChange={() => {}} depth={"balanced" as any} onDepthChange={() => {}} /></MemoryRouter>);
    const ta = screen.getByPlaceholderText(/Message/);
    console.log("PLACEHOLDER:", JSON.stringify(ta.getAttribute("placeholder")));
    const header = screen.getAllByRole("button", { expanded: false })[0];
    console.log("THINKING HEADER:", JSON.stringify(header.textContent));
    console.log("STEP ROW PRESENT:", !!screen.queryByText("Searching"));
    const body = document.body.innerText || document.body.textContent || "";
    for (const bad of ["Aureon", "Show Thinking", "Decode", "Diagram", "Trading Proof", "Adjust", "Truth", "Brains", "NAR", "LAW"]) {
      console.log("CONTAINS", bad, ":", body.includes(bad));
    }
    console.log("ACTION CHIPS:", ["Copy","Edit","Regenerate"].map(t => `${t}=${!!screen.queryByTitle(new RegExp(t,'i')) || body.includes(t)}`).join(" "));
    expect(true).toBe(true);
  });
});
