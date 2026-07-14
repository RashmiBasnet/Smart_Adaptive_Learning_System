"use client";

// Mastery-over-time chart (Recharts). Plots masteryPercentAfter exactly as
// the API provides it — values come from the API; never recomputed
// client-side. Y-axis fixed 0–100 so trends are comparable across concepts.

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import type { MasteryHistoryPoint } from "../lib/types/api";

export function MasteryChart({
  points,
  height = 240,
}: {
  points: MasteryHistoryPoint[];
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-center">
        <p className="text-sm font-medium text-[var(--ink-soft)]">
          Not enough attempts yet to draw a trend.
        </p>
        <p className="text-xs text-[var(--ink-faint)]">
          Take at least two quizzes to see your progress curve.
        </p>
      </div>
    );
  }

  const data = points.map((p) => ({
    ...p,
    label: new Date(p.attemptAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E1E1DA" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#8A8F9C" }}
          axisLine={{ stroke: "#E1E1DA" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#8A8F9C" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [`${value}%`, "Mastery"]}
          labelFormatter={(label) => `Attempt on ${label}`}
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #E1E1DA",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            fontSize: "0.8rem",
          }}
        />
        <Area
          type="monotone"
          dataKey="masteryPercentAfter"
          stroke="#1E3A5F"
          strokeWidth={2.5}
          fill="url(#masteryFill)"
          dot={{ r: 3.5, fill: "#1E3A5F", strokeWidth: 2, stroke: "#ffffff" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
