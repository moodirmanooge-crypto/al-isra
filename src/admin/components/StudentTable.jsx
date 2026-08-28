import { ArrowRight, CalendarDays } from "lucide-react";

export default function StudentTable({ students = [] }) {
  return (
    <div
      style={{
        background: "#0F172A",
        borderRadius: "24px",
        padding: "25px",
        color: "#fff",
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      }}
    >
      {/* Header */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 25,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          🎓 Recent Students
        </h2>

        <button
          style={{
            border: "none",
            background: "#6D5DF0",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          View All
        </button>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Name</th>
            <th style={th}>Class</th>
            <th style={th}>Phone</th>
            <th style={th}>Date Added</th>
            <th style={th}>Action</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student, index) => (
            <tr
              key={student.id}
              style={{
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <td style={td}>{index + 1}</td>

              <td style={td}>
                {student.fullName}
              </td>

              <td style={td}>
                {student.className}
              </td>

              <td style={td}>
                {student.studentPhone}
              </td>

              <td style={td}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CalendarDays size={16} />

                  {student.createdAt?.toDate
                    ? student.createdAt
                        .toDate()
                        .toLocaleDateString()
                    : "-"}
                </div>
              </td>

              <td style={td}>
                <button
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    border: "none",
                    background: "#6D5DF0",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <ArrowRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 30,
        }}
      >
        <button
          style={{
            border: "none",
            background:
              "linear-gradient(90deg,#6D5DF0,#8B5CF6)",
            color: "#fff",
            padding: "16px 45px",
            borderRadius: "18px",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          View All Students 👥
        </button>
      </div>
    </div>
  );
}

const th = {
  color: "#94A3B8",
  padding: "16px",
  textAlign: "left",
  fontWeight: 600,
};

const td = {
  padding: "18px 16px",
  color: "#E2E8F0",
};