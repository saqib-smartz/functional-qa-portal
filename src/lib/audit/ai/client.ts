import OpenAI from "openai";

let client: OpenAI | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set.");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/** Cost-efficient default; override via OPENAI_MODEL for a stronger model. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
