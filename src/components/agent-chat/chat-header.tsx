"use client";

import React from "react";
import { useChatStreamContext } from "@/providers/ChatStream";
import { Message } from "@langchain/langgraph-sdk";

type UsageSummary = {
  modelName: string | null;
  totalTokens: number;
  totalCost: number | null;
};

function extractNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getMessageModelName(message: Message): string | null {
  if (message.type !== "ai") return null;
  const aiMessage = message as Message & {
    response_metadata?: Record<string, unknown>;
    additional_kwargs?: Record<string, unknown>;
  };
  const fromResponse = aiMessage.response_metadata;
  const fromAdditional = aiMessage.additional_kwargs;

  return (
    (typeof fromResponse?.model_name === "string" && fromResponse.model_name) ||
    (typeof fromResponse?.model === "string" && fromResponse.model) ||
    (typeof fromAdditional?.model_name === "string" && fromAdditional.model_name) ||
    (typeof fromAdditional?.model === "string" && fromAdditional.model) ||
    null
  );
}

function getMessageTokenCount(message: Message): number {
  if (message.type !== "ai") return 0;
  const aiMessage = message as Message & {
    usage_metadata?: Record<string, unknown>;
    response_metadata?: Record<string, unknown>;
  };

  const usageTotal = extractNumber(aiMessage.usage_metadata?.total_tokens);
  if (usageTotal != null) return usageTotal;

  const usageInput = extractNumber(aiMessage.usage_metadata?.input_tokens) ?? 0;
  const usageOutput = extractNumber(aiMessage.usage_metadata?.output_tokens) ?? 0;
  const usageSum = usageInput + usageOutput;
  if (usageSum > 0) return usageSum;

  const responseTokenUsage = aiMessage.response_metadata?.token_usage as
    | Record<string, unknown>
    | undefined;
  const responseTotal = extractNumber(responseTokenUsage?.total_tokens);
  if (responseTotal != null) return responseTotal;

  const responseInput = extractNumber(responseTokenUsage?.prompt_tokens) ?? 0;
  const responseOutput = extractNumber(responseTokenUsage?.completion_tokens) ?? 0;
  return responseInput + responseOutput;
}

function getMessageUsdCost(message: Message): number | null {
  if (message.type !== "ai") return null;
  const aiMessage = message as Message & {
    response_metadata?: Record<string, unknown>;
    usage_metadata?: Record<string, unknown>;
  };
  const response = aiMessage.response_metadata;
  const tokenUsage = response?.token_usage as Record<string, unknown> | undefined;

  const direct =
    extractNumber(response?.total_cost_usd) ??
    extractNumber(response?.total_cost) ??
    extractNumber(response?.cost_usd) ??
    extractNumber(response?.cost) ??
    extractNumber(tokenUsage?.total_cost_usd) ??
    extractNumber(tokenUsage?.total_cost) ??
    extractNumber(tokenUsage?.cost_usd) ??
    extractNumber(tokenUsage?.cost) ??
    extractNumber(aiMessage.usage_metadata?.total_cost_usd) ??
    extractNumber(aiMessage.usage_metadata?.total_cost);

  return direct;
}

export function ChatHeader() {
  const { messages } = useChatStreamContext();

  const usageSummary = React.useMemo<UsageSummary>(() => {
    const aiMessages = messages.filter((m) => m.type === "ai");
    let modelName: string | null = null;
    let totalTokens = 0;
    let totalCost: number | null = null;

    aiMessages.forEach((message) => {
      const model = getMessageModelName(message);
      if (model) modelName = model;

      totalTokens += getMessageTokenCount(message);

      const cost = getMessageUsdCost(message);
      if (cost != null) {
        totalCost = (totalCost ?? 0) + cost;
      }
    });

    return { modelName, totalTokens, totalCost };
  }, [messages]);

  const formattedCost =
    usageSummary.totalCost == null ? "-" : usageSummary.totalCost.toFixed(4);

  return (
    <div className="flex items-center justify-end gap-3 px-3 sm:px-4 py-2 border-b border-gray-200 bg-white text-xs text-gray-600">
      <span className="hidden md:inline">
        {usageSummary.modelName ? usageSummary.modelName : "Model: -"}
      </span>

      <span className="hidden sm:inline">
        Tokens: {usageSummary.totalTokens.toLocaleString()}
      </span>

      <span className="hidden sm:inline font-medium">
        ${formattedCost}
      </span>
    </div>
  );
}
