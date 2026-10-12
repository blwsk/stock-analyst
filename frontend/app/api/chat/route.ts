import { createAgentUIStreamResponse } from "ai";

import { agent } from "@/lib/agent";

// useChat posts the conversation here, and gets the agent's steps back as a stream.
export async function POST(request: Request) {
  const { messages } = await request.json();
  return createAgentUIStreamResponse({ agent, uiMessages: messages });
}
