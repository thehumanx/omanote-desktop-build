export type ComposerArtifactKind = "note" | "todo" | "reminder" | "bookmark" | "event" | "pending-command";

export interface ComposerDetectionResult {
  kind: ComposerArtifactKind;
  value: string;
  command?: "todo" | "reminder" | "event";
  url?: string;
}

const urlPattern = /^(https?:\/\/)[^\s]+$/i;

export function detectComposerArtifact(rawValue: string): ComposerDetectionResult {
  const value = rawValue.trim();

  if (!value) {
    return { kind: "note", value: "" };
  }

  if (value.startsWith("/")) {
    if (value.length === 1 || /^\s/.test(value[1] ?? "")) {
      return { kind: "pending-command", value: value.slice(1).trimStart() };
    }
    const slashCommand = value.match(/^\/event(?:\s+|$)/i);
    if (slashCommand) {
      return { kind: "event", value: value.slice(slashCommand[0].length).trimStart(), command: "event" };
    }
  }

  if (value.startsWith("@")) {
    return { kind: "event", value: value.slice(1).trimStart() };
  }

  if (urlPattern.test(value)) {
    return { kind: "bookmark", value, url: value };
  }

  return { kind: "note", value };
}
