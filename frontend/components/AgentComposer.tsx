"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp, Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";

import WorkspacePreview from "@/components/WorkspacePreview";
import type { AgentMessage } from "@/lib/agent";

/**
 * Asks the agent to set up workspaces for a question. Streams its tool calls as they happen, and previews each
 * workspace it creates.
 */
export default function AgentComposer() {
  const [input, setInput] = useState("");
  const { mutate } = useSWRConfig();
  // Posts to /api/chat by default.
  const { messages, sendMessage, status, error } = useChat<AgentMessage>({
    // Show the new workspaces in the side panel.
    onFinish: () => mutate("/workspaces"),
  });
  // Keeps the latest step in view as the agent streams, like a chat.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    if (!input.trim() || busy) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  return (
    // Fills the page: the conversation scrolls, and the composer stays at the bottom.
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <h1 className="text-2xl font-medium text-zinc-900">
              What do you want to analyze today?
            </h1>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <p
                  key={message.id}
                  className="self-end rounded-lg bg-zinc-100 px-3 py-2 whitespace-pre-wrap text-zinc-900"
                >
                  {message.parts.map((part) =>
                    part.type === "text" ? part.text : null
                  )}
                </p>
              ) : (
                <div key={message.id} className="flex flex-col gap-2">
                  {message.parts.map((part, i) => {
                    const key = `${message.id}-${i}`;
                    switch (part.type) {
                      case "text":
                        return (
                          <p
                            key={key}
                            className="whitespace-pre-wrap text-zinc-900"
                          >
                            {part.text}
                          </p>
                        );
                      case "tool-web_search":
                        return (
                          <ToolStep
                            key={key}
                            done={part.state === "output-available"}
                            failed={part.state === "output-error"}
                          >
                            Searching the web
                            {part.input?.searchQueries?.length
                              ? `: ${part.input.searchQueries.join(" · ")}`
                              : "…"}
                            {part.state === "output-available" &&
                              ` (${part.output.length} results)`}
                          </ToolStep>
                        );
                      case "tool-create_workspace":
                        return part.state === "output-available" ? (
                          <WorkspacePreview key={key} workspace={part.output} />
                        ) : (
                          <ToolStep
                            key={key}
                            done={false}
                            failed={part.state === "output-error"}
                          >
                            Creating workspace
                            {part.input?.name ? ` “${part.input.name}”` : "…"}
                            {part.state === "output-error" &&
                              `: ${part.errorText}`}
                          </ToolStep>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              )
            )}
            {error && (
              <p className="text-sm text-red-600">Error: {error.message}</p>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        className="mx-auto mt-4 w-full max-w-2xl rounded-2xl border border-zinc-300 p-3 shadow-sm focus-within:border-zinc-500"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          autoFocus
          rows={2}
          className="w-full resize-none outline-none"
          placeholder="Top performing semiconductor stocks in Q4 2025"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter adds a line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!input.trim() || busy}
            aria-label={busy ? "Analyzing" : "Analyze"}
            title={busy ? "Analyzing" : "Analyze"}
            className="rounded-full bg-zinc-900 p-2 text-white disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function ToolStep({
  done,
  failed,
  children,
}: {
  done: boolean;
  failed: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`flex items-start gap-1.5 text-sm ${failed ? "text-red-600" : "text-zinc-500"}`}
    >
      {/* mt-0.5 centers the icon on the first line of text. */}
      {failed ? (
        <X className="mt-0.5 size-4 shrink-0" />
      ) : done ? (
        <Check className="mt-0.5 size-4 shrink-0" />
      ) : (
        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
      )}
      <span>{children}</span>
    </p>
  );
}
