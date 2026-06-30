"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Send } from "lucide-react";

interface ReportPreview {
  totalViews: number;
  topPost: { title: string; views: number } | null;
  platformBreakdown: { platform: string; views: number; percentage: number }[];
  followerGrowth: number;
  bestDay: string | null;
}

export default function ReportsPage() {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/reports/schedule")
      .then((r) => r.json())
      .then((d) => {
        if (d.schedule) {
          setEmail(d.schedule.email);
          setFrequency(d.schedule.frequency);
          setDayOfWeek(d.schedule.dayOfWeek);
          setIsActive(d.schedule.isActive);
        }
      });
  }, []);

  async function saveSchedule() {
    setSaving(true);
    await fetch("/api/reports/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, frequency, dayOfWeek, isActive }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function sendNow() {
    setSending(true);
    const res = await fetch("/api/reports/send", { method: "POST" });
    const data = await res.json();
    if (data.preview) setPreview(data.preview);
    setSending(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Scheduled Reports</h1>
      <p className="text-gray-600 text-sm mb-8">
        Get weekly or monthly performance summaries delivered to your inbox.
      </p>

      <div className="glass-card p-6 space-y-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={frequency === "weekly"}
                onChange={() => setFrequency("weekly")}
              />
              Weekly
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={frequency === "monthly"}
                onChange={() => setFrequency("monthly")}
              />
              Monthly
            </label>
          </div>
        </div>

        {frequency === "weekly" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Send On</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="text-sm rounded-xl border border-gray-200 px-3 py-2.5"
            >
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                (d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Reports enabled
        </label>

        <div className="flex gap-3 pt-2">
          <Button onClick={saveSchedule} disabled={saving || !email}>
            {saving && <Loader2 size={16} className="mr-1.5 animate-spin" />}
            {saved ? "Saved!" : "Save schedule"}
          </Button>
          <Button variant="outline" onClick={sendNow} disabled={sending}>
            {sending ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Send size={16} className="mr-1.5" />}
            Send test now
          </Button>
          <a href="/api/reports/export" download>
            <Button type="button" variant="outline">
              Export client report
            </Button>
          </a>
        </div>
      </div>

      {preview && (
        <div className="glass-card p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Mail size={18} /> Report preview
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>Total views:</strong> {preview.totalViews.toLocaleString()}
            </p>
            {preview.topPost && (
              <p>
                <strong>Top post:</strong> {preview.topPost.title} (
                {preview.topPost.views.toLocaleString()} views)
              </p>
            )}
            <p>
              <strong>Follower growth:</strong> +{preview.followerGrowth.toLocaleString()}
            </p>
            {preview.bestDay && (
              <p>
                <strong>Best day:</strong> {preview.bestDay}
              </p>
            )}
            {preview.platformBreakdown.length > 0 && (
              <div className="mt-3">
                <p className="font-medium mb-1">By platform:</p>
                <ul className="list-disc list-inside text-gray-600">
                  {preview.platformBreakdown.map((p) => (
                    <li key={p.platform} className="capitalize">
                      {p.platform}: {p.views.toLocaleString()} ({p.percentage}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Requires RESEND_API_KEY in environment. Cron calls GET /api/reports/send with CRON_SECRET daily.
      </p>
    </div>
  );
}
