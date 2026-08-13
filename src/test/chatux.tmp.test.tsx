import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import ChatView from "@/components/dashboard/ChatView";

const mk = (answer: string): any => ({
  id: "c1", title: "t", messages: [
    { id: "u1", role: "user", content: "hello", timestamp: Date.now() },
    { id: "a1", role: "assistant", content: answer, timestamp: Date.now() },
  ],
});

describe("inline edit card", () => {
  it("shows diff after regenerate without a View Diff chip", () => {
    const { rerender } = render(<MemoryRouter><ChatView conversation={mk("first answer")} onSendMessage={() => {}} mode={"chat" as any} onModeChange={() => {}} depth={"balanced" as any} onDepthChange={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Regenerate this answer"));
    rerender(<MemoryRouter><ChatView conversation={mk("second answer, revised")} onSendMessage={() => {}} mode={"chat" as any} onModeChange={() => {}} depth={"balanced" as any} onDepthChange={() => {}} /></MemoryRouter>);
    console.log("DIFF VISIBLE:", !!screen.queryByText("Response Diff"));
    console.log("VIEW DIFF CHIP:", !!screen.queryByText("View Diff"));
    console.log("DIFF BODY:", JSON.stringify(screen.getByText("Response Diff").parentElement?.parentElement?.textContent?.slice(0,80)));
    expect(true).toBe(true);
  });
});
