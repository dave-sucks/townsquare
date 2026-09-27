/**
 * Stage 6, Tag (agent, one call per mention): taxonomy tags this mention
 * supports, each with a quoted line of evidence, plus suggestions for tags
 * the taxonomy lacks. The taxonomy in the prompt comes from the database,
 * so an edit takes effect on the next run.
 */

import { prisma } from "@/lib/prisma";
import { formatPriceLevel } from "@/lib/places/format";
import { callStructured } from "../llm";
import { activeVersion } from "../agents/registry";
import { tagParseSchema, tagSchema } from "../agents/tag/schema";
import { CONFIDENCE_VALUE, ENGINE } from "../config";
import { renderExamples, selectExamples } from "../examples";
import { evidenceHolds } from "../text";
import { addTagSuggestions, setMentionTags } from "../write/tags";
import type { StepResult } from "../write/runs";

type TaxonomyTag = { id: string; slug: string; description: string | null; synonyms: string[]; category: { slug: string; displayName: string } };

export async function loadTaxonomy(): Promise<{ tags: TaxonomyTag[]; categories: string[]; text: string }> {
  const tags = await prisma.tag.findMany({
    where: { status: "active" },
    select: { id: true, slug: true, description: true, synonyms: true, category: { select: { slug: true, displayName: true, sortOrder: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const lines: string[] = [];
  let current = "";
  for (const t of tags) {
    if (t.category.slug !== current) {
      current = t.category.slug;
      lines.push(`${lines.length ? "\n" : ""}${t.category.displayName} (${t.category.slug}):`);
    }
    lines.push(`- ${t.slug}: ${t.description ?? ""}${t.synonyms.length ? ` (${t.synonyms.join(", ")})` : ""}`);
  }
  return { tags, categories: [...new Set(tags.map((t) => t.category.slug))], text: `Taxonomy:\n${lines.join("\n")}` };
}

export type TagResult = {
  kept: { slug: string; confidence: string; evidence: string }[];
  dropped: { slug: string; confidence: string; evidence: string; why: string }[];
  suggestions: { label: string; category: string; evidence: string }[];
};

export async function runTag(runId: string, reviewId: string): Promise<StepResult<TagResult>> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    select: {
      id: true,
      excerpt: true,
      dishes: true,
      verdict: true,
      socialPostCaption: true,
      ingestedPostId: true,
      ingestedPost: { select: { sourceId: true, postType: true } },
      place: { select: { name: true, types: true, priceLevel: true, primaryType: true } },
    },
  });
  const [version, taxonomy] = await Promise.all([activeVersion("tag"), loadTaxonomy()]);
  const examples = await selectExamples({
    agentKey: "tag",
    sourceId: review.ingestedPost?.sourceId,
    postType: review.ingestedPost?.postType,
    excludePostId: review.ingestedPostId,
    limit: ENGINE.tag.examples,
  });

  const dishes = (Array.isArray(review.dishes) ? review.dishes : []) as { name: string; sentiment: string }[];
  const types = (Array.isArray(review.place.types) ? review.place.types : []) as string[];
  const price = formatPriceLevel(review.place.priceLevel);
  const factLines = [
    `Name: ${review.place.name}`,
    `Google types: ${types.filter((t) => t !== "point_of_interest" && t !== "establishment").join(", ") || "unknown"}`,
    `Price level: ${price ?? "unknown"}`,
  ];
  // Mentions from before the engine have no excerpt yet; their caption stands in.
  const text = review.excerpt ?? (review.socialPostCaption ?? "").slice(0, 1200);
  const mentionLines = [
    `Excerpt: ${text ? `"${text}"` : "(none)"}`,
    `Dishes: ${dishes.length ? dishes.map((d) => `${d.name} (${d.sentiment})`).join(", ") : "none named"}`,
    `Verdict: ${review.verdict ?? "unknown"}`,
  ];
  const message = [
    `<place>\n${factLines.join("\n")}\n</place>`,
    `<mention>\n${mentionLines.join("\n")}\n</mention>`,
    renderExamples(examples, (e) => `Mention: ${JSON.stringify(e.input).slice(0, 500)}\nTags: ${JSON.stringify(e.expected).slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await callStructured({
    model: version.model,
    system: version.systemPrompt.replace("{{taxonomy}}", taxonomy.text),
    schema: tagSchema(taxonomy.tags.map((t) => t.slug), taxonomy.categories),
    parseWith: tagParseSchema,
    effort: version.effort,
    maxTokens: version.maxTokens,
    messages: [{ role: "user", content: message }],
  });

  // Gate: evidence must be in the mention or a fact line. Low confidence is dropped.
  const evidenceSource = [text, ...dishes.map((d) => d.name), ...factLines].join("\n");
  const bySlug = new Map(taxonomy.tags.map((t) => [t.slug, t]));
  const kept: TagResult["kept"] = [];
  const dropped: TagResult["dropped"] = [];
  for (const t of res.output.tags) {
    const why = !bySlug.has(t.slug)
      ? "not in the taxonomy"
      : !(ENGINE.tag.keep as readonly string[]).includes(t.confidence)
      ? "low confidence"
      : !evidenceHolds(evidenceSource, t.evidence)
        ? "evidence not found in the mention or place facts"
        : kept.some((k) => k.slug === t.slug)
          ? "duplicate"
          : null;
    if (why) dropped.push({ ...t, why });
    else kept.push(t);
  }

  await setMentionTags(
    review.id,
    kept.map((t) => ({
      tagId: bySlug.get(t.slug)!.id,
      confidence: CONFIDENCE_VALUE[t.confidence as keyof typeof CONFIDENCE_VALUE],
      evidence: t.evidence,
    })),
    runId,
  );
  const known = new Set(taxonomy.tags.flatMap((t) => [t.slug.replace(/_/g, " "), ...t.synonyms.map((s) => s.toLowerCase())]));
  const suggestions = res.output.suggestions
    .filter((s) => !known.has(s.label.toLowerCase().trim()))
    .map((s) => ({ ...s, category: taxonomy.categories.includes(s.category) ? s.category : "other" }));
  await addTagSuggestions(suggestions, { postId: review.ingestedPostId, reviewId: review.id });

  return { output: { kept, dropped, suggestions }, usage: [res], agentVersionId: version.id };
}
