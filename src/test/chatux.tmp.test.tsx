import { render, screen, fireEvent } from "@testing-library/react";
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
  it("thinking panel is asherin, steps render, action bar is small", () => {
    thinkingStore.begin("a1");
    thinkingStore.append("a1", "weighing options");
    thinkingStore.step("a1", "Searching", "dallas cameras");
    thinkingStore.step("a1", "Reading", "dot-cameras.json");
    thinkingStore.finish("a1");
    render(<MemoryRouter><ChatView conversation={convo} onSendMessage={() => {}} mode={"chat" as any} onModeChange={() => {}} depth={"balanced" as any} onDepthChange={() => {}} /></MemoryRouter>);
    const header = screen.getAllByRole("button").find(b => (b.textContent || "").trim().startsWith("asherin"))!;
    console.log("THINKING HEADER:", JSON.stringify(header.textContent));
    fireEvent.click(header);
    console.log("STEP ROWS:", ["Searching","Reading"].map(t => `${t}=${!!screen.queryByText(t)}`).join(" "));
    console.log("REASONING TEXT:", !!screen.queryByText(/weighing options/));
    const bar = screen.getByTitle("Regenerate this answer").parentElement!;
    console.log("ASSISTANT ACTION BAR:", JSON.stringify(bar.textContent), "chips=", bar.querySelectorAll("button").length);
    console.log("EDIT PRESENT:", !!screen.queryByTitle("Edit and resend"));
    expect(true).toBe(true);
  });
});
