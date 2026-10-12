"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Spinner } from "./ui";
import type { Action } from "@/lib/optimize";
import type { AiPlan } from "@/app/api/plan/route";
import { actionText } from "@/lib/plan-text";
import type { Lang } from "@/lib/types";

const ICON: Record<Action["kind"], string> = { shift: "⏰", reduce: "❄️", cut: "📴", setting: "⚙️" };

/**
 * Shows the optimizer's actions immediately (deterministic), then swaps in Gemini's
 * coaching for the same facts once it arrives. Falls back silently if AI is offline.
 */
export function PlanCard({ actions, facts, lang, applied, onApply, onUndo }: {
  actions: Action[];
  facts: Record<string, unknown>;
  lang: Lang;
  applied: boolean;
  onApply: () => void;
  onUndo: () => void;
}) {
  const key = JSON.stringify({ facts, lang });
  const [ai, setAi] = useState<{ key: string; plan: AiPlan } | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const req = useRef(0);
  const ur = lang === "ur";

  useEffect(() => {
    if (ai?.key === key) return;
    const id = ++req.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, facts }),
        });
        const j = await r.json();
        if (id !== req.current) return;
        if (!r.ok) {
          setOffline(true);
          return;
        }
        setOffline(false);
        setAi({ key, plan: j });
      } catch {
        if (id === req.current) setOffline(true);
      } finally {
        if (id === req.current) setBusy(false);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = ai?.key === key ? ai.plan : null;
  const steps = fresh?.steps?.length
    ? fresh.steps
    : actions.map((a) => ({ ...actionText(a, lang), impact: "" }));

  return (
    <Card
      icon="🤖"
      title={ur ? "Aap ka AI plan" : "Your AI plan"}
      action={
        busy ? (
          <Badge tone="amber">
            <Spinner /> <span className="ml-1">{ur ? "soch raha hai" : "thinking"}</span>
          </Badge>
        ) : fresh ? (
          <Badge tone="green">Gemini</Badge>
        ) : offline ? (
          <Badge>{ur ? "offline mode" : "offline mode"}</Badge>
        ) : null
      }
    >
      {fresh?.headline && <p className="mb-3 text-[15px] leading-snug font-medium text-stone-800">{fresh.headline}</p>}

      {actions.length === 0 ? (
        <p className="text-sm text-stone-600">
          {ur ? "Sab theek hai — aaj raat koi tabdeeli zaroori nahi. 👍" : "You're in good shape — no changes needed tonight. 👍"}
        </p>
      ) : (
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-base">
                {ICON[actions[i]?.kind ?? "setting"]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-stone-800">{s.title}</div>
                <div className="text-sm text-stone-600">{s.detail}</div>
                {s.impact && <div className="mt-0.5 text-xs font-medium text-emerald-700">{s.impact}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {fresh?.tip && (
        <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          💡 {fresh.tip}
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex gap-2">
          {applied ? (
            <Button variant="secondary" onClick={onUndo}>
              ↩ {ur ? "Wapas pehle jaisa" : "Undo plan"}
            </Button>
          ) : (
            <Button onClick={onApply}>✅ {ur ? "Plan apply karein" : "Apply this plan"}</Button>
          )}
        </div>
      )}
    </Card>
  );
}
