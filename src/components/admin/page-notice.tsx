import { Notice } from "@/components/ui/card";

/**
 * A confirmation after an action, chosen by the page's ?notice= value (set
 * when an action redirects). Unknown values show nothing.
 */
export function PageNotice({
  notice,
  messages,
}: {
  notice: string | string[] | undefined;
  messages: Record<string, { text: string; tone?: "success" | "error" }>;
}) {
  const key = typeof notice === "string" ? notice : undefined;
  const message = key ? messages[key] : undefined;
  if (!message) return null;
  return (
    <Notice tone={message.tone ?? "success"} className="mt-4">
      {message.text}
    </Notice>
  );
}
