"use client";

import { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Workflow, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowItem {
  id: string;
  name: string;
  sourcePlatform: string | null;
  targetPlatforms: string[];
  autoResize: boolean;
  removeWatermark: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function WorkflowsPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [autoResize, setAutoResize] = useState(true);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => {
        if (data.workflows) setItems(data.workflows);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function toggleTarget(id: string) {
    setTargets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function createWorkflow() {
    if (!name || targets.length === 0) return;

    await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        targetPlatforms: targets,
        autoResize,
        removeWatermark,
      }),
    });

    setName("");
    setTargets([]);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Workflows</h1>
          <p className="text-gray-600">
            Set up automated distribution rules — choose platforms, resizing, and
            watermark removal.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus size={16} className="mr-1" />
          New Workflow
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">Create Workflow</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TikTok to All Platforms"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Target platforms
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
        <p className="text-gray-500">Loading Workflows...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Workflow size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No Workflows Yet.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            Create your first workflow
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((wf) => (
            <div
              key={wf.id}
              className="bg-white rounded-2xl p-6 border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
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
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
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
                    {wf.removeWatermark && <span>Remove Watermarks</span>}
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
