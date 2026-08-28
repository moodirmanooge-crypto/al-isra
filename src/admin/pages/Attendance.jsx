import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  CalendarCheck,
  Users,
  School,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  X,
  Loader2,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Fixed class order: 1 -> 8 (primary), then F1 -> F4 (secondary/form)
const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8", "F1", "F2", "F3", "F4"];
function classRank(className) {
  const idx = CLASS_ORDER.indexOf(String(className || "").toUpperCase());
  return idx === -1 ? 999 : idx;
}

function ResponsiveStyles() {
  return (
    <style>{`
      .att-layout { display: flex; min-height: 100vh; background: #0b0a1c; }
      .att-content { flex: 1; min-width: 0; }
      .att-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
      .att-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .att-mini-table { width: 100%; border-collapse: collapse; min-width: 620px; }

      @media (max-width: 900px) {
        .att-summary-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
        .att-page-pad { padding: 16px !important; }
        .att-header-row { gap: 10px !important; }
        .att-header-title { font-size: 20px !important; }
        .att-class-card { padding: 16px !important; }
        .att-teacher-row { flex-direction: column; align-items: flex-start !important; }
        .att-pills-row { width: 100%; }
      }
      @media (max-width: 480px) {
        .att-summary-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [teachers, setTeachers] = useState({}); // id -> { fullName, photoUrl, subject(s) }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedClass, setExpandedClass] = useState({});
  const [expandedDate, setExpandedDate] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const teachersSnap = await getDocs(collection(db, "teachers"));
      const teacherMap = {};
      teachersSnap.docs.forEach((d) => {
        const data = d.data();
        teacherMap[d.id] = {
          fullName: data.fullName || data.username || d.id,
          photoUrl: data.photoUrl || data.photoURL || data.avatar || "",
          subject: data.subject || data.subjectName || "",
        };
      });
      setTeachers(teacherMap);

      const attSnap = await getDocs(collection(db, "attendance"));
      const list = attSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Drop records with no valid className / studentId / date — these are
        // broken or partial writes and were showing up as a fake "Fasalka: -" group.
        .filter(
          (r) =>
            r.className &&
            String(r.className).trim() !== "" &&
            r.studentId &&
            String(r.studentId).trim() !== "" &&
            r.date
        );
      setRecords(list);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group: className -> teacherId -> { dates: Set, records: [] }
  const groupedByClass = useMemo(() => {
    const map = {};

    records.forEach((r) => {
      const className = String(r.className || "-").toUpperCase();
      const teacherId = r.teacherId || "Unknown";

      if (!map[className]) map[className] = {};
      if (!map[className][teacherId]) {
        map[className][teacherId] = { dates: new Set(), records: [] };
      }

      if (r.date) map[className][teacherId].dates.add(r.date);
      map[className][teacherId].records.push(r);
    });

    return map;
  }, [records]);

  const classNames = useMemo(() => {
    // Start from the fixed list of 12 classes so every class always shows,
    // even ones with zero attendance records. Any class present in the data
    // but not in CLASS_ORDER (shouldn't normally happen) still gets included.
    const allClassNames = Array.from(
      new Set([...CLASS_ORDER, ...Object.keys(groupedByClass)])
    );

    return allClassNames
      .filter((className) => {
        if (!search.trim()) return true;
        const teacherIdsForClass = Object.keys(groupedByClass[className] || {});
        const matchesClass = className.toLowerCase().includes(search.toLowerCase());
        const matchesTeacher = teacherIdsForClass.some((tid) => {
          const name = teachers[tid]?.fullName || tid;
          return (
            name.toLowerCase().includes(search.toLowerCase()) ||
            tid.toLowerCase().includes(search.toLowerCase())
          );
        });
        return matchesClass || matchesTeacher;
      })
      .sort((a, b) => classRank(a) - classRank(b));
  }, [groupedByClass, search, teachers]);

  const toggleClassExpand = (key) => {
    setExpandedClass((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDate = (key) => {
    setExpandedDate((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateStatus = async (record, newStatus) => {
    if (record.status === newStatus || savingId === record.id) return;

    const prevStatus = record.status;
    setSavingId(record.id);
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
    );

    try {
      await updateDoc(doc(db, "attendance", record.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.log(err);
      alert("Khalad ayaa dhacay marka la kaydinayay: " + err.message);
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: prevStatus } : r))
      );
    } finally {
      setSavingId(null);
    }
  };

  const totalTeachers = useMemo(() => {
    return new Set(records.map((r) => r.teacherId || "Unknown")).size;
  }, [records]);
  const totalClasses = classNames.length
    ? Object.keys(groupedByClass).length
    : 0;
  const totalSessions = records.length;

  return (
    <div className="att-layout">
      <ResponsiveStyles />
      <Sidebar />

      <div className="att-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="att-page-pad" style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div className="att-header-row" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 55,
                height: 55,
                borderRadius: 15,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CalendarCheck color="#fff" size={26} />
            </div>
            <div>
              <h1 className="att-header-title" style={{ margin: 0, fontSize: 26, color: "#fff" }}>Attendance</h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Xaadirinta Fasallada oo dhan (1-8, F1-F4) iyo Macallimiintooda
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="att-summary-grid">
            <SummaryCard
              icon={School}
              label="Fasallada la Xaadiriyay"
              value={totalClasses}
              color="#22C55E"
            />
            <SummaryCard
              icon={Users}
              label="Macallimiinta Xaadiriyay"
              value={totalTeachers}
              color="#6d5df0"
            />
            <SummaryCard
              icon={CalendarCheck}
              label="Wadarta Xiisaduhu (Sessions)"
              value={totalSessions}
              color="#F59E0B"
            />
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 24, maxWidth: 420 }}>
            <Search
              size={17}
              color="#8b87ad"
              style={{ position: "absolute", left: 14, top: 13 }}
            />
            <input
              style={{ ...inputStyle, paddingLeft: 40 }}
              placeholder="Raadi fasalka ama macalinka..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Content: grouped by CLASS first */}
          {loading ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Soo raraya xogta...
            </div>
          ) : classNames.length === 0 ? (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Ma jiraan xaadirin la helay.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {classNames.map((className) => {
                const teachersMap = groupedByClass[className] || {};
                const teacherIdsForClass = Object.keys(teachersMap).sort();
                const totalDaysForClass = new Set(
                  teacherIdsForClass.flatMap((tid) =>
                    Array.from(teachersMap[tid].dates)
                  )
                ).size;
                const classKey = `class__${className}`;
                const isClassOpen = !!expandedClass[classKey];

                return (
                  <div
                    key={className}
                    className="att-class-card"
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 20,
                      padding: "22px 26px",
                    }}
                  >
                    {/* Class header — click to expand */}
                    <div
                      onClick={() => toggleClassExpand(classKey)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 14,
                            background: "linear-gradient(135deg,#22C55E,#16A34A)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 15,
                            flexShrink: 0,
                          }}
                        >
                          {className}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#fff", fontSize: 17 }}>
                            Fasalka: {className}
                          </div>
                          <div style={{ color: "#8b87ad", fontSize: 13 }}>
                            {teacherIdsForClass.length} macalin · {totalDaysForClass} maalmood
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Pill icon={Users} text={`${teacherIdsForClass.length} Macalin`} />
                        <Pill icon={CalendarCheck} text={`${totalDaysForClass} Maalmood`} />
                        {isClassOpen ? (
                          <ChevronUp size={18} color="#8b87ad" />
                        ) : (
                          <ChevronDown size={18} color="#8b87ad" />
                        )}
                      </div>
                    </div>

                    {/* Teachers within this class */}
                    {isClassOpen && (
                      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                        {teacherIdsForClass.map((teacherId) => {
                          const info = teachersMap[teacherId];
                          const teacherInfo = teachers[teacherId] || {};
                          const teacherName = teacherInfo.fullName || teacherId;
                          const teacherPhoto = teacherInfo.photoUrl;
                          const sortedDates = Array.from(info.dates).sort();
                          const tKey = `${classKey}__${teacherId}`;

                          // subject(s) taught in this class, from records if present, else teacher profile
                          const subjectsInClass = Array.from(
                            new Set(
                              info.records
                                .map((r) => r.subject || r.subjectName)
                                .filter(Boolean)
                            )
                          );
                          const subjectLabel =
                            subjectsInClass.length > 0
                              ? subjectsInClass.join(", ")
                              : teacherInfo.subject || "-";

                          return (
                            <div
                              key={tKey}
                              style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(139,108,245,0.18)",
                                borderRadius: 14,
                                padding: "14px 18px",
                              }}
                            >
                              <div
                                className="att-teacher-row"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: 10,
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  {teacherPhoto ? (
                                    <img
                                      src={teacherPhoto}
                                      alt={teacherName}
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "2px solid #8B5CF6",
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#fff",
                                        fontWeight: 700,
                                        fontSize: 14,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {teacherName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>
                                      {teacherName}
                                    </div>
                                    <div style={{ color: "#8b87ad", fontSize: 12 }}>
                                      Maadada: {subjectLabel}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="att-pills-row"
                                  onClick={() => toggleClassExpand(`${tKey}__toggle`)}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                  }}
                                >
                                  <span
                                    style={{
                                      background: "rgba(109,93,240,0.18)",
                                      color: "#8B5CF6",
                                      padding: "3px 10px",
                                      borderRadius: 20,
                                      fontSize: 12,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {sortedDates.length} maalmood
                                  </span>
                                  {expandedClass[`${tKey}__toggle`] ? (
                                    <ChevronUp size={16} color="#8b87ad" />
                                  ) : (
                                    <ChevronDown size={16} color="#8b87ad" />
                                  )}
                                </div>
                              </div>

                              {expandedClass[`${tKey}__toggle`] && (
                                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                                  {sortedDates.map((date) => {
                                    const sessionsOnDate = info.records
                                      .filter((r) => r.date === date)
                                      .sort((a, b) => {
                                        if (a.sessionNumber !== b.sessionNumber) {
                                          return (a.sessionNumber || 0) - (b.sessionNumber || 0);
                                        }
                                        return (a.studentName || "").localeCompare(
                                          b.studentName || ""
                                        );
                                      });
                                    const sessionNums = Array.from(
                                      new Set(sessionsOnDate.map((r) => r.sessionNumber))
                                    ).sort((a, b) => a - b);
                                    const dateKey = `${tKey}__${date}`;
                                    const isDateOpen = !!expandedDate[dateKey];

                                    const presentCount = sessionsOnDate.filter(
                                      (r) => r.status === "Present"
                                    ).length;
                                    const absentCount = sessionsOnDate.filter(
                                      (r) => r.status === "Absent"
                                    ).length;

                                    return (
                                      <div
                                        key={date}
                                        style={{
                                          background: "rgba(139,108,245,0.06)",
                                          border: "1px solid rgba(139,108,245,0.2)",
                                          borderRadius: 12,
                                          overflow: "hidden",
                                        }}
                                      >
                                        <div
                                          onClick={() => toggleDate(dateKey)}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "10px 14px",
                                            cursor: "pointer",
                                            flexWrap: "wrap",
                                            gap: 8,
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Clock size={13} color="#8b87ad" />
                                            <span style={{ color: "#e5e3f7", fontSize: 13.5, fontWeight: 600 }}>
                                              {date}
                                            </span>
                                            <span style={{ color: "#8b87ad", fontSize: 12 }}>
                                              ({sessionNums.length} xiisadood · {sessionsOnDate.length} arday)
                                            </span>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span
                                              style={{
                                                color: "#22C55E",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                background: "rgba(34,197,94,0.12)",
                                                padding: "3px 9px",
                                                borderRadius: 20,
                                              }}
                                            >
                                              {presentCount} Present
                                            </span>
                                            <span
                                              style={{
                                                color: "#EF4444",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                background: "rgba(239,68,68,0.12)",
                                                padding: "3px 9px",
                                                borderRadius: 20,
                                              }}
                                            >
                                              {absentCount} Absent
                                            </span>
                                            {isDateOpen ? (
                                              <ChevronUp size={16} color="#8b87ad" />
                                            ) : (
                                              <ChevronDown size={16} color="#8b87ad" />
                                            )}
                                          </div>
                                        </div>

                                        {isDateOpen && (
                                          <div style={{ padding: "0 14px 14px" }}>
                                            <div className="att-table-wrap">
                                              <table className="att-mini-table">
                                                <thead>
                                                  <tr>
                                                    <MiniTh>Ardayga</MiniTh>
                                                    <MiniTh>ID</MiniTh>
                                                    <MiniTh>Xiisad</MiniTh>
                                                    <MiniTh>Waqti</MiniTh>
                                                    <MiniTh>Status</MiniTh>
                                                    <MiniTh>Wax ka beddel</MiniTh>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {sessionsOnDate.map((r) => (
                                                    <tr
                                                      key={r.id}
                                                      style={{
                                                        borderTop: "1px solid rgba(139,108,245,0.12)",
                                                      }}
                                                    >
                                                      <MiniTd>
                                                        <div
                                                          style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                          }}
                                                        >
                                                          <div
                                                            style={{
                                                              width: 26,
                                                              height: 26,
                                                              borderRadius: "50%",
                                                              background:
                                                                "linear-gradient(135deg,#6D5DF0,#8B5CF6)",
                                                              display: "flex",
                                                              alignItems: "center",
                                                              justifyContent: "center",
                                                              color: "#fff",
                                                              fontWeight: 700,
                                                              fontSize: 11,
                                                              flexShrink: 0,
                                                            }}
                                                          >
                                                            {(r.studentName || "?").charAt(0).toUpperCase()}
                                                          </div>
                                                          {r.studentName || "-"}
                                                        </div>
                                                      </MiniTd>
                                                      <MiniTd>{r.studentId || "-"}</MiniTd>
                                                      <MiniTd>#{r.sessionNumber ?? "-"}</MiniTd>
                                                      <MiniTd>{r.sessionTime || "-"}</MiniTd>
                                                      <MiniTd>
                                                        <span
                                                          style={{
                                                            padding: "4px 10px",
                                                            borderRadius: 20,
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            background:
                                                              r.status === "Present"
                                                                ? "rgba(34,197,94,0.15)"
                                                                : "rgba(239,68,68,0.15)",
                                                            color:
                                                              r.status === "Present"
                                                                ? "#22C55E"
                                                                : "#EF4444",
                                                          }}
                                                        >
                                                          ● {r.status || "Absent"}
                                                        </span>
                                                      </MiniTd>
                                                      <MiniTd>
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                          <button
                                                            onClick={() => updateStatus(r, "Present")}
                                                            disabled={savingId === r.id}
                                                            title="Present"
                                                            style={{
                                                              ...editBtn,
                                                              background:
                                                                r.status === "Present" ? "#22C55E" : "#1F2937",
                                                              color:
                                                                r.status === "Present" ? "#fff" : "#94A3B8",
                                                              opacity: savingId === r.id ? 0.6 : 1,
                                                              cursor:
                                                                savingId === r.id ? "not-allowed" : "pointer",
                                                            }}
                                                          >
                                                            {savingId === r.id ? (
                                                              <Loader2 size={13} />
                                                            ) : (
                                                              <Check size={13} />
                                                            )}
                                                          </button>
                                                          <button
                                                            onClick={() => updateStatus(r, "Absent")}
                                                            disabled={savingId === r.id}
                                                            title="Absent"
                                                            style={{
                                                              ...editBtn,
                                                              background:
                                                                r.status === "Absent" ? "#EF4444" : "#1F2937",
                                                              color:
                                                                r.status === "Absent" ? "#fff" : "#94A3B8",
                                                              opacity: savingId === r.id ? 0.6 : 1,
                                                              cursor:
                                                                savingId === r.id ? "not-allowed" : "pointer",
                                                            }}
                                                          >
                                                            {savingId === r.id ? (
                                                              <Loader2 size={13} />
                                                            ) : (
                                                              <X size={13} />
                                                            )}
                                                          </button>
                                                        </div>
                                                      </MiniTd>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        background: "#0B1120",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 20,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#8b87ad" }}>{label}</div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(139,108,245,0.1)",
        border: "1px solid rgba(139,108,245,0.25)",
        borderRadius: 20,
        padding: "6px 14px",
        color: "#c4b8f7",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Icon size={14} />
      {text}
    </div>
  );
}

function MiniTh({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 10px",
        color: "#8b87ad",
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function MiniTd({ children }) {
  return (
    <td
      style={{
        padding: "8px 10px",
        color: "#e5e3f7",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const editBtn = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  boxSizing: "border-box",
  border: "1.5px solid rgba(139,108,245,0.35)",
  borderRadius: 12,
  fontSize: 14,
  color: "#e5e3f7",
  outline: "none",
  background: "rgba(255,255,255,0.02)",
};