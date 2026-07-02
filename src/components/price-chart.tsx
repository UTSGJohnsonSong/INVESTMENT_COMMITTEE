"use client";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/lib/types";

export function PriceChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0)
    return <p className="text-xs text-muted">No price history available.</p>;
  const up = data[data.length - 1].close >= data[0].close;
  const color = up ? "#22c55e" : "#ef4444";
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "#7d8898", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#1f2836" }}
            minTickGap={60}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#7d8898", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: "#10151d",
              border: "1px solid #1f2836",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#7d8898" }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#pc)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
