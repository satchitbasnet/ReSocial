"use client";

import { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Workflow, ToggleLeft, ToggleRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowItem {
  id: string;
  name: string;
  workflowType: "new_content" | "existing_content";
  contentType: "video" | "photos";
  sourcePlatform: string | null;
  sourceAccountId: string | null;
  targetPlatforms: string[];
  autoResize: boolean;
  removeWatermark: boolean;
  isActive: boolean;
  lastPolledAt: string | null;
  createdAt: string;
}

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
}

const SOURCE_PLATFORMS = PLATFORMS.filter((p) =>
  ["tiktok", "youtube", "instagram", "facebook"].includes(p.id)
);

export default function WorkflowsPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [workflowType, setWorkflowType] = useState<
    "new_content" | "existing_content"
  >("new_content");
  const [contentType, setContentType] = useState<"video" | "photos">("video");
  const [sourcePlatform, setSourcePlatform] = useState<string>("");
  const [sourceAccountId, setSourceAccountId] = useState<string>("");
  const [targets, setTargets] = useState<string[]>([]);
  const [autoResize, setAutoResize] = useState(true);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([fetch("/api/workflows"), fetch("/api/accounts")]).then(
      async ([wfRes, accRes]) => {
        const wfData = await wfRes.json();
        const accData = await accRes.json();
        if (wfData.workflows) setItems(wfData.workflows);
        if (accData.accounts) setAccounts(accData.accounts);
        setLoading(false);
      }
    );
  }

  useEffect(() => {
    load();
  }, []);

  function toggleTarget(id: string) {
    setTargets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  const sourceAccounts = accounts.filter(
    (a) => !sourcePlatform || a.platform === sourcePlatform
  );

  async function createWorkflow() {
    if (!name || targets.length === 0) return;

    await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        workflowType,
        contentType,
        sourcePlatform: sourcePlatform || undefined,
        sourceAccountId: sourceAccountId || undefined,
        targetPlatforms: targets,
        autoResize,
        removeWatermark,
      }),
    });

    setName("");
    setTargets([]);
    setSourcePlatform("");
    setSourceAccountId("");
    setShowForm(false);
    load();
  }

  async function deleteWorkflow(id: string) {
    await fetch(`/api/workflows?id=${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/workflows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    load();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workflows</h1>
          <p className="text-gray-600">
            Automate repurposing like Repurpose.io — pick a source, choose
            destinations, and let ReSocial distribute new or existing content.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus size={16} className="mr-1" />
          Create Workflow
        </Button>
      </div>

      <div className="mb-8 rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-600 space-y-2">
        <p className="font-medium text-gray-900">How it works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Connect accounts on Connected Accounts</li>
          <li>Create a workflow: source (left) → destinations (right)</li>
          <li>
            <strong>Repurpose new content</strong> — auto-share when you publish
            on the source (polled every 15 min)
          </li>
          <li>
            <strong>Repurpose existing content</strong> — backfill from your
            source library (coming soon)
          </li>
        </ol>
      </div>

      {showForm && (
        <div className="glass-card p-6 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Create Workflow</h3>
          <div className="space-y-5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TikTok → Instagram + YouTube"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Workflow type
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["new_content", "Repurpose new content"],
                    ["existing_content", "Repurpose existing content"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWorkflowType(id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm border",
                      workflowType === id
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Content type
              </p>
              <div className="flex gap-2">
                {(
                  [
                    ["video", "Videos"],
                    ["photos", "Photos & carousels"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setContentType(id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm border",
                      contentType === id
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-600"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {contentType === "photos" && (
                <p className="text-xs text-amber-700 mt-2">
                  Photo and carousel publishing is rolling out — video workflows
                  are fully supported today.
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Source (optional)
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SOURCE_PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSourcePlatform(
                          sourcePlatform === p.id ? "" : p.id
                        );
                        setSourceAccountId("");
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border",
                        sourcePlatform === p.id
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600"
                      )}
                    >
                      <PlatformIcon platform={p.id} size={16} />
                      {p.name}
                    </button>
                  ))}
                </div>
                {sourcePlatform && (
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  >
                    <option value="">Any connected {sourcePlatform} account</option>
                    {sourceAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="hidden md:flex items-center justify-center pt-8 text-gray-300">
                <ArrowRight size={24} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Destinations
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleTarget(p.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                        targets.includes(p.id)
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600"
                      )}
                    >
                      <PlatformIcon platform={p.id} size={16} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoResize}
                  onChange={(e) => setAutoResize(e.target.checked)}
                  className="rounded"
                />
                Auto-resize videos
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={removeWatermark}
                  onChange={(e) => setRemoveWatermark(e.target.checked)}
                  className="rounded"
                />
                Remove watermarks
              </label>
            </div>

            <div className="flex gap-3">
              <Button onClick={createWorkflow}>Save Workflow</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading workflows…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 glass-card">
          <Workflow size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No workflows yet.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            Create your first workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((wf) => (
            <div key={wf.id} className="glass-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        wf.isActive
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {wf.isActive ? "Active" : "Paused"}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {wf.workflowType.replace("_", " ")} · {wf.contentType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap text-sm">
                    {wf.sourcePlatform && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border px-2 py-1 rounded-lg">
                          <PlatformIcon platform={wf.sourcePlatform} size={14} />
                          {PLATFORMS.find((p) => p.id === wf.sourcePlatform)?.name}
                        </span>
                        <ArrowRight size={14} className="text-gray-400" />
                      </>
                    )}
                    {wf.targetPlatforms.map((pid) => {
                      const p = PLATFORMS.find((x) => x.id === pid);
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg"
                        >
                          {p && <PlatformIcon platform={p.id} size={14} />}
                          {p?.name}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-500">
                    {wf.autoResize && <span>Auto-resize</span>}
                    {wf.removeWatermark && <span>Remove watermarks</span>}
                    {wf.lastPolledAt && (
                      <span>
                        Last checked:{" "}
                        {new Date(wf.lastPolledAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(wf.id, wf.isActive)}
                    className="text-gray-400 hover:text-brand-600"
                    title={wf.isActive ? "Pause" : "Activate"}
                  >
                    {wf.isActive ? (
                      <ToggleRight size={24} className="text-brand-600" />
                    ) : (
                      <ToggleLeft size={24} />
                    )}
                  </button>
                  <button
                    onClick={() => deleteWorkflow(wf.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
