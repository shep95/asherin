import { useState, useEffect, useRef, useCallback } from "react";

const COMMON_PROMPTS = [
  "Analyze this dataset",
  "Write a report about",
  "Summarize this document",
  "Explain how",
  "Compare and contrast",
  "Create a plan for",
  "Debug this code",
  "Optimize this function",
  "Write tests for",
  "Research the latest on",
  "Find information about",
  "Generate a summary of",
  "What are the key trends in",
  "Help me understand",
  "Break down the data on",
  "Investigate the connection between",
  "Create a dashboard for",
  "Extract insights from",
  "Fact check this claim",
  "Write a Python script to",
];

interface SmartAutocompleteProps {
  value: string;
  onAccept: (suggestion: string) => void;
}

const SmartAutocomplete = ({ value, onAccept }: SmartAutocompleteProps) => {
  const [suggestion, setSuggestion] = useState("");
  const [userPhrases, setUserPhrases] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("aureon_user_phrases") || "[]"); } catch { return []; }
  });

  // Track user's commonly used phrases
  useEffect(() => {
    const handler = () => {
      try { setUserPhrases(JSON.parse(localStorage.getItem("aureon_user_phrases") || "[]")); } catch {}
    };
    window.addEventListener("aureon-phrase-tracked", handler);
    return () => window.removeEventListener("aureon-phrase-tracked", handler);
  }, []);

  useEffect(() => {
    if (!value || value.length < 3 || value.includes("\n")) {
      setSuggestion("");
      return;
    }

    const lower = value.toLowerCase();
    const allPhrases = [...userPhrases, ...COMMON_PROMPTS];
    
    // Find first match
    const match = allPhrases.find(p => 
      p.toLowerCase().startsWith(lower) && p.toLowerCase() !== lower
    );

    if (match) {
      setSuggestion(match.slice(value.length));
    } else {
      setSuggestion("");
    }
  }, [value, userPhrases]);

  if (!suggestion) return null;

  return (
    <span 
      className="text-muted-foreground/25 pointer-events-none select-none"
      aria-hidden="true"
    >
      {suggestion}
    </span>
  );
};

// Call this when user sends a message to learn their phrases
export function trackPhrase(text: string) {
  if (!text || text.length < 10 || text.length > 200) return;
  try {
    const stored = JSON.parse(localStorage.getItem("aureon_user_phrases") || "[]") as string[];
    const exists = stored.findIndex(p => p.toLowerCase() === text.toLowerCase());
    if (exists !== -1) {
      // Move to front (most used)
      stored.splice(exists, 1);
    }
    const next = [text, ...stored].slice(0, 50);
    localStorage.setItem("aureon_user_phrases", JSON.stringify(next));
    window.dispatchEvent(new Event("aureon-phrase-tracked"));
  } catch {}
}

export default SmartAutocomplete;
