import { MessageContentComplex } from "@langchain/core/messages";

export function getContentString(
  content: string | MessageContentComplex[] | undefined
): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  const textBlocks = content.filter(
    (block) => block.type === "text" && typeof block.text === "string"
  );

  return textBlocks.map((block) => (block as { text: string }).text).join("\n");
}

export function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday =
    d.toDateString() ===
    new Date(now.setDate(now.getDate() - 1)).toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
