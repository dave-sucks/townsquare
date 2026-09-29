"use client";

/**
 * One agent. Left: the prompt editor (version picker, prompt, model, effort,
 * max tokens, notes, Save draft). Right: the playground, which runs the
 * version on a post (or, for Summarize, a place) without writing anything,
 * optionally side by side with the active version. The actions menu promotes
 * a version (promoting an older one is a rollback) or archives a draft.
 */

import * as React from "react";
import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArchiveIcon, ArrowDown01Icon, RocketIcon, Tick01Icon } from "@hugeicons/core-free-icons";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TraceStep } from "@/components/chat/chain-of-thought";
import { adminFetch } from "@/components/admin/admin-fetch";
import { formatCost, formatDuration, shortModel } from "@/components/admin/run-format";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type Version = {
  id: string;
  version: number;
  systemPrompt: string;
  model: string;
  effort: string | null;
  maxTokens: number;
  notes: string | null;
  status: "draft" | "active" | "archived";
  createdAt: string;
};

type AgentData = {
  agent: { key: string; name: string; description: string | null; activeVersionId: string | null };
  versions: Version[];
  models: string[];
  recentPosts: { id: string; shortcode: string; handle: string; caption: string | null }[];
  recentPlaces: { id: string; name: string; googlePlaceId: string }[];
};

type RunResult = { output: unknown; tokensIn: number; tokensOut: number; tokensCached: number; costUsd: number; latencyMs: number };

type Form = { systemPrompt: string; model: string; effort: string | null; maxTokens: number; notes: string };

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

const formOf = (v: Version): Form => ({ systemPrompt: v.systemPrompt, model: v.model, effort: v.effort, maxTokens: v.maxTokens, notes: v.notes ?? "" });
const sameForm = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);
const humanize = (slug: string) => slug.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The output as the product would show it: mentions, picks, chips or a summary. */
function RenderedOutput({ agentKey, output }: { agentKey: string; output: unknown }) {
  if (agentKey === "read") {
    const o = obj(output);
    const places = arr(o.places).map(obj);
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {o.postType === "not_a_place" ? `Not a place${o.notPlaceReason ? `: ${o.notPlaceReason}` : ""}` : `${humanize(String(o.postType ?? "post"))} · ${places.length} ${places.length === 1 ? "place" : "places"}`}
        </p>
        {places.map((p, i) => (
          <div key={i} className="rounded-lg border p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium">{String(p.name)}</p>
              {p.role ? <Badge variant="secondary" className="font-normal">{humanize(String(p.role))}</Badge> : null}
              {p.verdict && p.verdict !== "none" ? <Badge variant="outline" className="font-normal">{String(p.verdict)}</Badge> : null}
            </div>
            {p.excerpt ? <p className="text-xs text-muted-foreground">{String(p.excerpt)}</p> : null}
            {arr(p.dishes).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {arr(p.dishes).map(obj).map((d, j) => (
                  <Badge key={j} variant="secondary" className="font-normal">
                    {String(d.name)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (agentKey === "resolve") {
    return (
      <div className="space-y-1.5">
        {arr(output).map(obj).map((r, i) => {
          const agent = obj(r.agent);
          return (
            <div key={i} className="rounded-lg border p-2.5">
              <p className="text-sm">
                <span className="font-medium">{String(r.place)}</span>
                <span className="text-muted-foreground"> → </span>
                {r.outcome === "accepted" ? String(r.placeName ?? r.googlePlaceId) : <span className="text-amber-600">sent to review</span>}
              </p>
              {agent.reason ? <p className="text-xs text-muted-foreground">{String(agent.reason)}</p> : null}
            </div>
          );
        })}
      </div>
    );
  }
  if (agentKey === "tag") {
    return (
      <div className="space-y-1.5">
        {arr(output).map(obj).map((r, i) => {
          const o = obj(r.output);
          return (
            <div key={i} className="rounded-lg border p-2.5 space-y-1.5">
              <p className="text-sm font-medium">{String(r.place)}</p>
              <div className="flex flex-wrap gap-1">
                {arr(o.kept).map(obj).map((t, j) => (
                  <Badge key={j} variant="secondary" className="font-normal" title={String(t.evidence ?? "")}>
                    {humanize(String(t.slug))}
                  </Badge>
                ))}
                {arr(o.kept).length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
              </div>
              {arr(o.dropped).length > 0 && <p className="text-xs text-muted-foreground">{arr(o.dropped).length} dropped by the gates</p>}
            </div>
          );
        })}
      </div>
    );
  }
  const o = obj(output);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{o.summary ? String(o.summary) : o.skipped ? `Skipped: ${String(o.reason ?? "")}` : "No summary."}</p>
      {arr(o.knownFor).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {arr(o.knownFor).map((d, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {typeof d === "string" ? d : String(obj(d).name ?? "")}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultColumn({ title, agentKey, result }: { title: string; agentKey: string; result: RunResult }) {
  return (
    <div className="min-w-0 space-y-2" data-testid={`result-${title.split(" ")[0]}`}>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {[`${result.tokensIn.toLocaleString()} in`, result.tokensCached ? `${result.tokensCached.toLocaleString()} cached` : null, `${result.tokensOut.toLocaleString()} out`, formatCost(result.costUsd), formatDuration(result.latencyMs)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <RenderedOutput agentKey={agentKey} output={result.output} />
      <TraceStep label="Raw output">
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(result.output, null, 2)}</pre>
      </TraceStep>
    </div>
  );
}

export default function AgentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { data, isLoading, error } = useQuery<AgentData>({
    queryKey: ["admin-agent", key],
    queryFn: () => adminFetch(`/api/admin/agents/${key}`),
  });

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Form | null>(null);
  const [target, setTarget] = React.useState("");
  const [compare, setCompare] = React.useState(true);
  const [result, setResult] = React.useState<{ draft: RunResult; active: RunResult | null; versionId: string } | null>(null);
  const [confirmPromote, setConfirmPromote] = React.useState(false);

  const versions = data?.versions ?? [];
  const active = versions.find((v) => v.id === data?.agent.activeVersionId) ?? null;
  // Open on the newest draft if there is one, else the active version.
  const selected = versions.find((v) => v.id === selectedId) ?? versions.find((v) => v.status === "draft") ?? active ?? versions[0] ?? null;

  React.useEffect(() => {
    if (selected) setForm(formOf(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const dirty = !!selected && !!form && !sameForm(form, formOf(selected));
  const isSummarize = key === "summarize";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-agent", key] });
    queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
  };

  const saveDraft = useMutation({
    mutationFn: () =>
      adminFetch<{ version: Version }>(`/api/admin/agents/${key}`, {
        method: "POST",
        json: {
          action: "save_draft",
          ...(selected?.status === "draft" ? { versionId: selected.id } : {}),
          systemPrompt: form!.systemPrompt,
          model: form!.model,
          effort: form!.model.startsWith("claude-haiku") ? null : form!.effort,
          maxTokens: form!.maxTokens,
          notes: form!.notes.trim() || null,
        },
      }),
    onSuccess: ({ version }) => {
      setSelectedId(version.id);
      refresh();
      toast.success(selected?.status === "draft" ? `Draft v${version.version} saved` : `Saved as draft v${version.version}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runPlayground = useMutation({
    mutationFn: async () => {
      let versionId = selected!.id;
      if (dirty) versionId = (await saveDraft.mutateAsync()).version.id;
      const res = await adminFetch<{ draft: RunResult; active: RunResult | null }>(`/api/admin/agents/${key}`, {
        method: "POST",
        json: { action: "playground", versionId, compare, target: target.trim() },
      });
      return { ...res, versionId };
    },
    onSuccess: (res) => setResult(res),
    onError: (err: Error) => toast.error(err.message),
  });

  const versionAction = useMutation({
    mutationFn: ({ action, versionId }: { action: "promote" | "archive"; versionId: string }) =>
      adminFetch(`/api/admin/agents/${key}`, { method: "POST", json: { action, versionId } }),
    onSuccess: (_r, { action }) => {
      refresh();
      setConfirmPromote(false);
      toast.success(action === "promote" ? `v${selected?.version} is live. The pipeline uses it from the next run.` : `v${selected?.version} archived`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ranVersion = versions.find((v) => v.id === result?.versionId);
  const rollback = selected && active && selected.version < active.version;

  return (
    <AdminShell
      wide
      actions={
        selected && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid="button-agent-actions" />}>
              Actions
              <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>v{selected.version}</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={selected.status === "active" || dirty}
                  onClick={() => setTimeout(() => setConfirmPromote(true), 100)}
                  data-testid="button-promote"
                >
                  <HugeiconsIcon icon={RocketIcon} />
                  {rollback ? `Roll back to v${selected.version}` : `Promote v${selected.version}`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={selected.status !== "draft"}
                  onClick={() => versionAction.mutate({ action: "archive", versionId: selected.id })}
                  data-testid="button-archive"
                >
                  <HugeiconsIcon icon={ArchiveIcon} />
                  Archive draft
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    >
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/agents" className="hover:text-foreground hover:underline" data-testid="link-all-agents">
          Agents
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">{data?.agent.name ?? key}</span>
      </nav>
      <div>
        {isLoading || !form || !selected ? (
          error ? (
            <p className="py-16 text-center text-sm text-muted-foreground">{(error as Error).message}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-[520px] w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 space-y-3" data-testid="section-prompt-editor">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-testid="select-version" />}>
                    v{selected.version}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[240px]">
                    {versions.map((v) => (
                      <DropdownMenuItem key={v.id} onClick={() => setSelectedId(v.id)} data-testid={`option-version-${v.version}`}>
                        <span>v{v.version}</span>
                        <span className="text-xs text-muted-foreground">
                          {v.status} · {formatDistanceToNowStrict(new Date(v.createdAt), { addSuffix: true })}
                        </span>
                        <HugeiconsIcon icon={Tick01Icon} className={cn("ml-auto h-4 w-4", v.id === selected.id ? "opacity-100" : "opacity-0")} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant={selected.status === "active" ? "default" : "secondary"} className="font-normal" data-testid="badge-version-status">
                  {selected.status === "active" ? "Active" : selected.status === "draft" ? "Draft" : "Archived"}
                </Badge>
                {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
              </div>

              <Textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                className="min-h-[420px] max-h-[65vh] overflow-y-auto text-sm leading-relaxed"
                spellCheck={false}
                data-testid="input-system-prompt"
              />

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <NativeSelect size="sm" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} data-testid="select-model">
                    {(data?.models ?? []).map((m) => (
                      <NativeSelectOption key={m} value={m}>
                        {shortModel(m)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Effort</Label>
                  <NativeSelect
                    size="sm"
                    value={form.model.startsWith("claude-haiku") ? "" : form.effort ?? ""}
                    disabled={form.model.startsWith("claude-haiku")}
                    onChange={(e) => setForm({ ...form, effort: e.target.value || null })}
                    data-testid="select-effort"
                  >
                    <NativeSelectOption value="">Default</NativeSelectOption>
                    {EFFORTS.map((e) => (
                      <NativeSelectOption key={e} value={e}>
                        {e}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Max tokens</Label>
                  <Input
                    type="number"
                    value={form.maxTokens}
                    onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) || 0 })}
                    className="h-7 w-24 text-sm"
                    data-testid="input-max-tokens"
                  />
                </div>
              </div>

              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What changed in this version (optional)" data-testid="input-version-notes" />

              <div className="flex items-center gap-2">
                <Button size="sm" disabled={!dirty || saveDraft.isPending} onClick={() => saveDraft.mutate()} data-testid="button-save-draft">
                  {saveDraft.isPending ? "Saving..." : selected.status === "draft" ? "Save draft" : "Save as new draft"}
                </Button>
                {dirty && (
                  <Button variant="ghost" size="sm" onClick={() => setForm(formOf(selected))} data-testid="button-discard">
                    Discard changes
                  </Button>
                )}
              </div>
            </section>

            <section className="min-w-0 space-y-3" data-testid="section-playground">
              <div>
                <p className="text-sm font-medium">Playground</p>
                <p className="text-xs text-muted-foreground">Runs v{selected.version} without saving anything. It costs what a real call costs.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={isSummarize ? "Place id" : "Instagram post URL or shortcode"}
                  data-testid="input-playground-target"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8 shrink-0" data-testid="button-recent-targets" />}>
                    Recent
                    <HugeiconsIcon icon={ArrowDown01Icon} className="h-3 w-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 max-h-80">
                    {isSummarize
                      ? (data?.recentPlaces ?? []).map((p) => (
                          <DropdownMenuItem key={p.id} onClick={() => setTarget(p.googlePlaceId)} data-testid={`option-target-${p.googlePlaceId}`}>
                            <span className="truncate">{p.name}</span>
                          </DropdownMenuItem>
                        ))
                      : (data?.recentPosts ?? []).map((p) => (
                          <DropdownMenuItem key={p.id} onClick={() => setTarget(p.shortcode)} data-testid={`option-target-${p.shortcode}`}>
                            <span className="min-w-0 truncate">
                              @{p.handle} <span className="text-muted-foreground">{p.caption?.replace(/\s+/g, " ")}</span>
                            </span>
                          </DropdownMenuItem>
                        ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    size="sm"
                    checked={compare}
                    onCheckedChange={setCompare}
                    disabled={!active || active.id === selected.id}
                    data-testid="switch-compare"
                  />
                  Compare with active{active ? ` (v${active.version})` : ""}
                </label>
                <Button size="sm" disabled={!target.trim() || runPlayground.isPending} onClick={() => runPlayground.mutate()} data-testid="button-run-playground">
                  {runPlayground.isPending ? "Running..." : dirty ? "Save and run" : "Run"}
                </Button>
              </div>

              {runPlayground.isPending && <Skeleton className="h-48 w-full rounded-xl" />}
              {result && !runPlayground.isPending && (
                <div className={cn("grid gap-4 rounded-xl border p-3", result.active && "md:grid-cols-2")} data-testid="playground-results">
                  <ResultColumn title={`v${ranVersion?.version ?? "?"} ${ranVersion?.status ?? ""}`} agentKey={key} result={result.draft} />
                  {result.active && <ResultColumn title={`v${active?.version ?? "?"} active`} agentKey={key} result={result.active} />}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <Dialog open={confirmPromote} onOpenChange={setConfirmPromote}>
        <DialogContent data-testid="dialog-promote">
          <DialogHeader>
            <DialogTitle>{rollback ? `Roll back to v${selected?.version}?` : `Promote v${selected?.version}?`}</DialogTitle>
            <DialogDescription>
              The pipeline runs v{selected?.version} of {data?.agent.name} from the next post on{active ? `, and v${active.version} is archived` : ""}. Promote v{active?.version ?? "the old version"} again to undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPromote(false)}>
              Cancel
            </Button>
            <Button disabled={versionAction.isPending} onClick={() => selected && versionAction.mutate({ action: "promote", versionId: selected.id })} data-testid="button-confirm-promote">
              {rollback ? "Roll back" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
