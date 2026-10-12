import { openai } from "@ai-sdk/openai";
import { type InferAgentUIMessage, isStepCount, ToolLoopAgent, tool } from "ai";
import Parallel from "parallel-web";
import { z } from "zod";

import { API_URL } from "@/lib/api";
import { RANGES, TIMEFRAMES, type Workspace } from "@/lib/types";

// The earliest bar on Alpaca's free IEX feed; earlier windows chart nothing.
const DATA_START = "2020-07-27";

// Reads PARALLEL_API_KEY from the environment.
const parallel = new Parallel();

const webSearch = tool({
  description:
    "Search the web. Use it to find out which companies and dates are relevant to the user's question.",
  inputSchema: z.object({
    objective: z
      .string()
      .describe("The question you want answered, in a sentence."),
    searchQueries: z
      .array(z.string())
      .describe("2-3 short keyword queries, 3-6 words each."),
  }),
  execute: async ({ objective, searchQueries }) => {
    const { results } = await parallel.search({
      objective,
      search_queries: searchQueries,
      max_chars_total: 10_000,
    });
    return results.map(({ url, title, publish_date, excerpts }) => ({
      url,
      title,
      publish_date,
      excerpts,
    }));
  },
});

// Mirrors WorkspaceCreate and ChartConfig in backend/src/schemas.py, which validates it.
const createWorkspace = tool({
  description:
    "Create a workspace that charts the given tickers over the given time window.",
  inputSchema: z.object({
    name: z.string().describe("A short title for what the workspace analyzes."),
    tickers: z
      .array(z.string())
      .max(20)
      .describe("US stock symbols, e.g. AAPL or BRK.B."),
    chart: z.object({
      range: z
        .enum(RANGES)
        .nullable()
        .describe("A window ending now. Null when start and end are set."),
      timeframe: z
        .enum(TIMEFRAMES)
        .describe(
          "Bar size. Minute bars allow windows of up to 31 days, 1Hour up to 366 days, 1Day any length. " +
            "1D allows minute and hour bars only; 6M and 1Y allow 1Hour and 1Day only."
        ),
      start: z
        .string()
        .nullable()
        .describe("ISO 8601 start of a past window, or null when using range."),
      end: z
        .string()
        .nullable()
        .describe("ISO 8601 end of a past window, or null when using range."),
    }),
  }),
  execute: async (workspace) => {
    // Rejected so the model picks a window with data, rather than creating an empty workspace.
    if (workspace.chart.start && workspace.chart.start < DATA_START)
      throw new Error(
        `No price data before ${DATA_START}; pick a later window`
      );
    const res = await fetch(`${API_URL}/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workspace),
    });
    // The validation details go back to the model, so it can fix its input and try again.
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    // The browser renders the created workspace as a preview, so return all of it.
    return (await res.json()) as Workspace;
  },
});

const INSTRUCTIONS = `You help an analyst study S&P 500 stocks.

Given the user's question or situation:
1. Search the web once with web_search to work out which companies are relevant (with their ticker symbols)
   and which dates matter. Make that one search count.
2. Create one workspace with create_workspace that charts those tickers over a time window that shows the
   situation, with a timeframe that suits the window's length.
3. Reply briefly: what you found, and what the workspace shows.

Don't search for prices: the workspaces chart them. Price data starts on ${DATA_START}, so there is none for
earlier events (such as the COVID crash of early 2020); say so rather than charting an empty window.`;

export type AgentMessage = InferAgentUIMessage<typeof agent>;

export const agent = new ToolLoopAgent({
  model: openai("gpt-6-luna"),
  instructions: INSTRUCTIONS,
  tools: { web_search: webSearch, create_workspace: createWorkspace },
  // Search, create the workspace, then reply, with a spare step to retry a workspace the backend rejects.
  stopWhen: isStepCount(4),
  // One call per step, so the step-level limit below also limits calls.
  providerOptions: { openai: { parallelToolCalls: false } },
  // Each tool succeeds at most once per turn: one web search, and one workspace (so one preview). Failed calls
  // aren't results, so the model can fix its input and retry.
  prepareStep: ({ steps }) => {
    const used = new Set(
      steps.flatMap((step) => step.toolResults.map((result) => result.toolName))
    );
    return {
      activeTools: (["web_search", "create_workspace"] as const).filter(
        (name) => !used.has(name)
      ),
    };
  },
  // The model needs today's date to tell recent events from past ones.
  prepareCall: (settings) => ({
    ...settings,
    instructions: `${settings.instructions}\n\nToday is ${new Date().toDateString()}.`,
  }),
});
