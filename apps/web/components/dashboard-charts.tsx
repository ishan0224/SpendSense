"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type {
  CategoryAnalyticsItem,
  DailyAnalyticsItem,
  MerchantAnalyticsItem
} from "@spendsense/shared";

const palette = ["#0f766e", "#2563eb", "#c2410c", "#7c3aed", "#be123c", "#4d7c0f"];

function rupees(amountMinor: number): string {
  return `Rs ${(amountMinor / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0
  })}`;
}

export function CategoryPieChart({ data }: { data: CategoryAnalyticsItem[] }) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No category data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="totalMinor" nameKey="categoryName" outerRadius={92}>
            {data.map((item, index) => (
              <Cell key={item.categoryName} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => rupees(Number(value))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyLineChart({ data }: { data: DailyAnalyticsItem[] }) {
  if (data.every((item) => item.totalMinor === 0)) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No daily spend data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value) => String(value).slice(8)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 100}`} width={44} />
          <Tooltip formatter={(value) => rupees(Number(value))} />
          <Line type="monotone" dataKey="totalMinor" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MerchantBarChart({ data }: { data: MerchantAnalyticsItem[] }) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-500">No merchant data</div>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 36 }}>
          <CartesianGrid stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 100}`} />
          <YAxis
            type="category"
            dataKey="merchantOriginal"
            tick={{ fontSize: 11 }}
            width={100}
            interval={0}
          />
          <Tooltip formatter={(value) => rupees(Number(value))} />
          <Bar dataKey="totalMinor" fill="#0f766e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
