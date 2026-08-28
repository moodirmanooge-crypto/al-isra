//src/admin/components/statminicard.jsx
export default function StatMiniCard({ title, subtitle, value, trend, iconBg, icon, lineColor }) {
  const isUp = trend >= 0;
  const wavePath = "M0,22 Q10,8 20,18 T40,14 T60,20 T80,6 T100,16";

  return (
    <div
      style={{
        background: "linear-gradient(160deg,#1c1840,#241f52)",
        borderRadius: "16px",
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          minWidth: "46px",
          borderRadius: "12px",
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{title}</div>
        <div style={{ color: "#8b87ad", fontSize: "11px" }}>{subtitle}</div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#fff", fontSize: "22px", fontWeight: 700 }}>{value}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", justifyContent: "flex-end" }}>
          <span style={{ color: isUp ? "#4ade80" : "#f87171", fontWeight: 700 }}>
            {isUp ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        </div>
        <div style={{ color: "#6b6890", fontSize: "10px" }}>Tan iyo bishii hore</div>
      </div>

      <svg viewBox="0 0 100 26" style={{ width: "60px", height: "26px" }} preserveAspectRatio="none">
        <path d={wavePath} fill="none" stroke={lineColor} strokeWidth="2" />
      </svg>
    </div>
  );
}