/**
 * Web-search citations → the [N] markers CitedMarkdownText already renders.
 *
 * Anthropic returns a cited answer as many small text blocks: an uncited
 * block, then a block whose `citations` hold the sources for exactly that
 * span, then another uncited block, and so on. The AI SDK keeps each block as
 * its own text part, and every text part renders as its own markdown root, so
 * without this transform one sentence would break into several paragraphs
 * and the citations would have nowhere to go.
 *
 * This streamText transform does three things:
 *   1. Merges consecutive text blocks into one text part (drops the
 *      text-end / text-start pair between them).
 *   2. Numbers every distinct source URL in order of first appearance and
 *      drops repeat `source` chunks, so the client's list of source-url parts
 *      is exactly the numbering used here.
 *   3. Appends "[n]" after each cited block, one per distinct URL.
 *
 * The client (message-sources-context) numbers the message's source-url parts
 * the same way; a marker "[3]" is the third distinct URL in the message.
 */

import type { StreamTextTransform, TextStreamPart, ToolSet } from "ai";

type Citation = { url?: string };

function citationsOf(chunk: { providerMetadata?: unknown }): Citation[] {
  const meta = chunk.providerMetadata as { anthropic?: { citations?: unknown } } | undefined;
  const list = meta?.anthropic?.citations;
  return Array.isArray(list) ? (list as Citation[]) : [];
}

export function citationMarkers<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
  return () => {
    const indexByUrl = new Map<string, number>();
    // The text part currently open on the client, and a text-end held back
    // in case the next chunk is another text-start we should merge into it.
    let openId: string | null = null;
    let heldEnd: TextStreamPart<TOOLS> | null = null;

    const indexFor = (url: string) => {
      let n = indexByUrl.get(url);
      if (n == null) {
        n = indexByUrl.size + 1;
        indexByUrl.set(url, n);
      }
      return n;
    };

    const flush = (controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>) => {
      if (heldEnd) controller.enqueue(heldEnd);
      heldEnd = null;
      openId = null;
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        switch (chunk.type) {
          case "text-start": {
            if (heldEnd && openId) {
              // Merge: keep the open part, swallow this start and the held end.
              heldEnd = null;
              return;
            }
            openId = chunk.id;
            controller.enqueue(chunk);
            return;
          }
          case "text-delta": {
            controller.enqueue(openId ? { ...chunk, id: openId } : chunk);
            return;
          }
          case "text-end": {
            const id = openId ?? chunk.id;
            const markers = [
              ...new Set(
                citationsOf(chunk)
                  .map((c) => (typeof c.url === "string" ? indexFor(c.url) : null))
                  .filter((n): n is number => n != null),
              ),
            ]
              .map((n) => `[${n}]`)
              .join("");
            if (markers) controller.enqueue({ type: "text-delta", id, text: markers });
            heldEnd = { ...chunk, id };
            openId = id;
            return;
          }
          case "source": {
            if (chunk.sourceType === "url") {
              if (indexByUrl.has(chunk.url)) return;
              indexFor(chunk.url);
            }
            controller.enqueue(chunk);
            return;
          }
          default: {
            flush(controller);
            controller.enqueue(chunk);
          }
        }
      },
      flush(controller) {
        flush(controller);
      },
    });
  };
}
