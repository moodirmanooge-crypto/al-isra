export default function StatsCards({
  students,
  teachers,
  classes,
  cashiers,
}) {
  const cards = [
    {
      title: "Dhammaan Ardayda",
      value: students,
      icon: "👨‍🎓",
      color: "#22c55e",
    },
    {
      title: "Dhammaan Macalimiinta",
      value: teachers,
      icon: "👨‍🏫",
      color: "#8b5cf6",
    },
    {
      title: "Dhammaan Fasalada",
      value: classes,
      icon: "📚",
      color: "#f59e0b",
    },
    {
      title: "Khasnada",
      value: cashiers,
      icon: "💰",
      color: "#ec4899",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: 20,
      }}
    >
      {cards.map((item) => (
        <div
          key={item.title}
          style={{
            background: "#0F172A",
            color: "#fff",
            borderRadius: 20,
            padding: 25,
          }}
        >
          <div
            style={{
              fontSize: 45,
            }}
          >
            {item.icon}
          </div>

          <h3>{item.title}</h3>

          <h1
            style={{
              fontSize: 45,
              color: item.color,
            }}
          >
            {item.value}
          </h1>

          <p
            style={{
              color: "#94A3B8",
            }}
          >
            Tan iyo bishii hore
          </p>
        </div>
      ))}
    </div>
  );
}