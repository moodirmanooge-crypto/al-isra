import { MoreVertical, ArrowUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// Simple deterministic sparkline data generator based on the card's value,
// so each card gets a slightly different (but stable) wave shape.
function makeSparkData(seed) {
  const points = 8;
  const data = [];
  let v = 40 + (seed % 20);
  for (let i = 0; i < points; i++) {
    v += Math.sin(i + seed) * 12 + (i % 2 === 0 ? 6 : -3);
    data.push({ i, v: Math.max(10, Math.round(v)) });
  }
  return data;
}

export default function DashboardCard({
  title,
  value,
  icon,
  color = "#6D5DF0",
  percent,
}) {
  const numericSeed =
    typeof value === "number" ? value : title ? title.length * 7 : 5;
  const sparkData = makeSparkData(numericSeed);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "20px 22px",
        boxShadow: "0 4px 18px rgba(17, 24, 39, 0.06)",
        border: "1px solid rgba(17,24,39,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: `${color}1A`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: "#6B7280",
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              {title}
            </div>
          </div>
        </div>

        <MoreVertical size={18} color="#9CA3AF" style={{ cursor: "pointer" }} />
      </div>

      {percent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "#16A34A",
            fontWeight: 600,
          }}
        >
          <ArrowUp size={13} />
          <span>{percent} this month</span>
        </div>
      )}

      <div style={{ height: 46, margin: "0 -4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}