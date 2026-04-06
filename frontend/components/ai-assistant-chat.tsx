"use client";

import { useState } from "react";

import { postAIChat } from "@/lib/api";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const starterQuestions = [
  "How many students are active?",
  "Which classes are full?",
  "Show usage summary",
];

export function AIAssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about usage, active students, full classes, or smart recommendations.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(nextQuestion?: string) {
    const prompt = (nextQuestion ?? question).trim();

    if (!prompt) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: prompt,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");

    try {
      setIsSending(true);
      const response = await postAIChat(prompt);
      const assistantText = response.suggestions.length
        ? `${response.answer}\n\nTry next: ${response.suggestions.join(" | ")}`
        : response.answer;

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: assistantText,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the AI assistant.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40">
      {isOpen ? (
        <section className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] border border-slate-100 bg-white p-4 shadow-2xl shadow-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
                AI Assistant
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Real school data, plan signals, and recommendations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-[1.5rem] bg-slate-50 p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                  message.role === "assistant"
                    ? "bg-white text-slate-700"
                    : "bg-blue-600 text-white"
                }`}
              >
                <p className="whitespace-pre-line">{message.text}</p>
              </div>
            ))}
            {isSending ? (
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">
                Thinking...
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {starterQuestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void handleSend(item)}
                disabled={isSending}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
              >
                {item}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Ask about students, classes, usage..."
              className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending}
              className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:opacity-70"
            >
              Send
            </button>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="pointer-events-auto mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-blue-200"
      >
        {isOpen ? "Hide AI" : "Ask AI"}
      </button>
    </div>
  );
}
