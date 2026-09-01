import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  Download,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Users,
  ClipboardList,
  GraduationCap,
  Filter,
} from "lucide-react";

// ✅ Liiska rasmiga ah ee fasallada u kala horreeya sida aad rabto
const fixedClassOrder = [
  "Fasalka 1aad",
  "Fasalka 2aad",
  "Fasalka 3aad",
  "PP",
  "PI",
  "G8 ",
  "G8 A",
  "F1",
  "F1 A",
  "F2",
  "F3",
  "F4",
];

// ✅ Liiska Noocyada Imtixaanka (Exam Types)
const EXAM_TYPES = [
  { key: "all", label: "Dhammaan Imtixaannada" },
  { key: "monthly1", label: "Monthly Exam Test 1" },
  { key: "midterm", label: "Midterm Exam" },
  { key: "monthly2", label: "Monthly Test 2" },
  { key: "final", label: "Final Exam" },
];

const normalizeStr = (str) =>
  String(str || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

function getClassBadge(cls) {
  const badges = {
    "Fasalka 1aad": "1aad",
    "Fasalka 2aad": "2aad",
    "Fasalka 3aad": "3aad",
    PP: "PP",
    PI: "PI",
  };
  return badges[cls] || cls;
}

function ResponsiveStyles() {
  return (
    <style>{`
      .ex-layout {
        display: flex;
        min-height: 100vh;
        background: #0b0a1c;
      }

      .ex-content {
        flex: 1;
        min-width: 0;
      }

      .ex-class-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 18px;
      }

      .ex-table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      @media (max-width: 900px) {
        .ex-page-pad {
          padding: 16px !important;
        }

        .ex-header-row {
          gap: 10px !important;
        }

        .ex-header-title {
          font-size: 20px !important;
        }

        .ex-class-grid {
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .ex-toolbar {
          flex-direction: column;
          align-items: stretch !important;
        }
      }

      @media (max-width: 480px) {
        .ex-class-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}

export default function Exams() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [customClasses, setCustomClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedExamType, setSelectedExamType] = useState("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const [studentsSnap, examsSnap, resultsSnap, customSnap] =
        await Promise.all([
          getDocs(collection(db, "students")),
          getDocs(collection(db, "exams")),
          getDocs(collection(db, "results")),
          getDocs(collection(db, "customClasses")),
        ]);

      setStudents(
        studentsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setExams(
        examsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setResults(
        resultsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );

      setCustomClasses(
        customSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (err) {
      console.error(
        "Khalad ayaa dhacay markii xogta Exams laga soo qaadanayay:",
        err
      );
    } finally {
      setLoading(false);
    }
  }

  // ✅ Habaynta horraynta fasallada siday u kala horreeyaan
  const allClassOptions = useMemo(() => {
    const customNames = customClasses
      .map((c) => c.name)
      .filter(
        (name) =>
          !fixedClassOrder.some(
            (c) => normalizeStr(c) === normalizeStr(name)
          )
      );

    customNames.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return [...fixedClassOrder, ...customNames];
  }, [customClasses]);

  // ✅ Imtixaannada fasalka la doortay + kala shaandhaynta nooca imtixaanka
  const examsForClass = useMemo(() => {
    if (!selectedClass) return [];
    return exams
      .filter((e) => {
        const matchesClass = normalizeStr(e.className) === normalizeStr(selectedClass);
        const matchesType =
          selectedExamType === "all" ||
          normalizeStr(e.examType) === normalizeStr(selectedExamType) ||
          normalizeStr(e.type) === normalizeStr(selectedExamType);
        return matchesClass && matchesType;
      })
      .sort((a, b) => (a.subject || "").localeCompare(b.subject || ""));
  }, [exams, selectedClass, selectedExamType]);

  // ✅ Gradebook-ka oo lagu xiray nooca imtixaanka (Exam Type)
  const gradebook = useMemo(() => {
    if (!selectedClass) return { subjects: [], rows: [] };

    const classStudents = students.filter(
      (s) => normalizeStr(s.className) === normalizeStr(selectedClass)
    );

    const subjectList = Array.from(
      new Set(
        examsForClass.map((e) => e.subject || e.examName || "Subject")
      )
    );

    const rows = classStudents.map((stu) => {
      const studentResults = results.filter((r) => {
        const matchesStudent = r.studentId === (stu.studentId || stu.id);
        const matchesType =
          selectedExamType === "all" ||
          normalizeStr(r.examType) === normalizeStr(selectedExamType) ||
          normalizeStr(r.type) === normalizeStr(selectedExamType);
        return matchesStudent && matchesType;
      });

      let totalMarks = 0;
      let totalMax = 0;
      const bySubject = {};

      subjectList.forEach((subj) => {
        const match = studentResults.find(
          (r) => (r.subject || r.examName) === subj
        );
        if (match) {
          const marks = Number(match.marks) || 0;
          const maxMarks = Number(match.maxMarks) || 0;
          bySubject[subj] = { marks, maxMarks };
          totalMarks += marks;
          totalMax += maxMarks;
        } else {
          bySubject[subj] = null;
        }
      });

      const average =
        totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;

      return {
        studentId: stu.studentId || stu.id,
        fullName: stu.fullName || stu.name || "—",
        bySubject,
        totalMarks,
        totalMax,
        average,
        hasAnyResult: totalMax > 0,
      };
    });

    return { subjects: subjectList, rows };
  }, [selectedClass, students, examsForClass, results, selectedExamType]);

  function exportCSV() {
    if (!selectedClass || gradebook.rows.length === 0) return;

    const headers = ["Student Name", ...gradebook.subjects, "Total", "Average %"];
    const lines = [headers.join(",")];

    gradebook.rows.forEach((row) => {
      const cells = [
        `"${row.fullName}"`,
        ...gradebook.subjects.map((subj) => {
          const cell = row.bySubject[subj];
          return cell ? cell.marks : "";
        }),
        `${row.totalMarks}/${row.totalMax}`,
        `${row.average}%`,
      ];
      lines.push(cells.join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Class-${selectedClass}-${selectedExamType}-Results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ex-layout">
      <ResponsiveStyles />
      <Sidebar />

      <div className="ex-content">
        <div style={{ padding: "20px 24px 0" }}>
          <Topbar />
        </div>

        <div className="ex-page-pad" style={{ padding: "26px 30px" }}>
          {/* Header */}
          <div
            className="ex-header-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
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
              <GraduationCap color="#fff" size={26} />
            </div>
            <div>
              <h1
                className="ex-header-title"
                style={{ margin: 0, fontSize: 26, color: "#fff" }}
              >
                Exams & Results
              </h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Dooro fasal iyo nooca imtixaanka si aad u aragto natiijooyinka.
              </div>
            </div>
          </div>

          {loading && (
            <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
              Xogta ayaa la soo qaadayaa...
            </div>
          )}

          {!loading && !selectedClass && (
            <div className="ex-class-grid">
              {allClassOptions.map((cls) => {
                const examCount = exams.filter(
                  (e) => normalizeStr(e.className) === normalizeStr(cls)
                ).length;
                const studentCount = students.filter(
                  (s) => normalizeStr(s.className) === normalizeStr(cls)
                ).length;
                return (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    style={{
                      background: "linear-gradient(160deg,#151233,#181341)",
                      border: "1px solid rgba(139,108,245,0.25)",
                      borderRadius: 20,
                      padding: "20px 22px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 13,
                          background:
                            "linear-gradient(135deg,#22C55E,#16A34A)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {getClassBadge(cls)}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 16,
                            color: "#fff",
                          }}
                        >
                          {cls}
                        </div>
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "#8b87ad",
                            marginTop: 2,
                          }}
                        >
                          {examCount} exam{examCount !== 1 ? "s" : ""} ·{" "}
                          {studentCount} arday
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(139,108,245,0.1)",
                          border: "1px solid rgba(139,108,245,0.25)",
                          borderRadius: 20,
                          padding: "5px 12px",
                          color: "#c4b8f7",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <ClipboardList size={13} /> {examCount} Exam
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(139,108,245,0.1)",
                          border: "1px solid rgba(139,108,245,0.25)",
                          borderRadius: 20,
                          padding: "5px 12px",
                          color: "#c4b8f7",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <Users size={13} /> {studentCount} Arday
                      </span>
                    </div>

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#8B5CF6",
                        marginTop: 2,
                      }}
                    >
                      Fiiri natiijada <ChevronRight size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && selectedClass && (
            <div>
              <div
                className="ex-toolbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 18,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <button
                  onClick={() => setSelectedClass(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: "none",
                    color: "#8B5CF6",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <ChevronLeft size={16} /> Dhamaan Fasallada
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Filter-ka Exam Type */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(21, 18, 51, 0.8)",
                      border: "1px solid rgba(139,108,245,0.3)",
                      borderRadius: 12,
                      padding: "6px 12px",
                    }}
                  >
                    <Filter size={15} color="#8b87ad" />
                    <select
                      value={selectedExamType}
                      onChange={(e) => setSelectedExamType(e.target.value)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {EXAM_TYPES.map((t) => (
                        <option
                          key={t.key}
                          value={t.key}
                          style={{ background: "#151233", color: "#fff" }}
                        >
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={exportCSV}
                    disabled={gradebook.rows.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 12,
                      border: "none",
                      background:
                        gradebook.rows.length === 0
                          ? "rgba(139,108,245,0.25)"
                          : "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor:
                        gradebook.rows.length === 0 ? "not-allowed" : "pointer",
                      opacity: gradebook.rows.length === 0 ? 0.6 : 1,
                    }}
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Exams for this class */}
              <div
                style={{
                  background: "linear-gradient(160deg,#151233,#181341)",
                  border: "1px solid rgba(139,108,245,0.25)",
                  borderRadius: 20,
                  padding: "20px 24px",
                  marginBottom: 20,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <BookOpen size={16} color="#8B5CF6" /> {selectedClass} —
                  Imtixaanada (
                  {EXAM_TYPES.find((t) => t.key === selectedExamType)?.label})
                </h3>
                {examsForClass.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#8b87ad", margin: 0 }}>
                    Weli imtixaano laguma diiwaan gelin noocan imtixaan ah.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {examsForClass.map((e) => (
                      <span
                        key={e.id}
                        style={{
                          background: "rgba(139,108,245,0.1)",
                          border: "1px solid rgba(139,108,245,0.25)",
                          padding: "8px 14px",
                          borderRadius: 20,
                          fontSize: 12.5,
                          color: "#c4b8f7",
                          fontWeight: 600,
                        }}
                      >
                        {e.examName || e.subject} · {e.subject || "—"} · Max{" "}
                        {e.maxMarks || "—"}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Gradebook */}
              <div
                style={{
                  background: "linear-gradient(160deg,#151233,#181341)",
                  border: "1px solid rgba(139,108,245,0.25)",
                  borderRadius: 20,
                  padding: "20px 24px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 14px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ClipboardList size={16} color="#8B5CF6" /> {selectedClass} —
                  Natiijooyinka (Gradebook)
                </h3>

                {gradebook.rows.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#8b87ad", margin: 0 }}>
                    Weli arday looma diiwaan gelin fasalkan.
                  </p>
                ) : (
                  <div className="ex-table-wrap">
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                        minWidth: 560 + gradebook.subjects.length * 110,
                      }}
                    >
                      <thead>
                        <tr>
                          <ExamTh sticky>Ardayga</ExamTh>
                          {gradebook.subjects.map((subj) => (
                            <ExamTh key={subj}>{subj}</ExamTh>
                          ))}
                          <ExamTh>Total</ExamTh>
                          <ExamTh>Average</ExamTh>
                        </tr>
                      </thead>
                      <tbody>
                        {gradebook.rows.map((row) => (
                          <tr
                            key={row.studentId}
                            style={{
                              borderTop: "1px solid rgba(139,108,245,0.12)",
                            }}
                          >
                            <ExamTd sticky bold>
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
                                  {(row.fullName || "?")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                {row.fullName}
                              </div>
                            </ExamTd>
                            {gradebook.subjects.map((subj) => {
                              const cell = row.bySubject[subj];
                              return (
                                <ExamTd key={subj}>
                                  {cell
                                    ? `${cell.marks}/${cell.maxMarks}`
                                    : "—"}
                                </ExamTd>
                              );
                            })}
                            <ExamTd bold>
                              {row.totalMarks}/{row.totalMax}
                            </ExamTd>
                            <ExamTd>
                              {row.hasAnyResult ? (
                                <span
                                  style={{
                                    background:
                                      row.average >= 50
                                        ? "rgba(34,197,94,0.15)"
                                        : "rgba(239,68,68,0.15)",
                                    color:
                                      row.average >= 50
                                        ? "#22C55E"
                                        : "#EF4444",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: "4px 12px",
                                    borderRadius: 20,
                                  }}
                                >
                                  {row.average}%
                                </span>
                              ) : (
                                <span style={{ color: "#8b87ad" }}>—</span>
                              )}
                            </ExamTd>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamTh({ children, sticky }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        color: "#8b87ad",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...(sticky
          ? { position: "sticky", left: 0, background: "#181341" }
          : {}),
      }}
    >
      {children}
    </th>
  );
}

function ExamTd({ children, sticky, bold }) {
  return (
    <td
      style={{
        padding: "10px 14px",
        color: "#e5e3f7",
        fontSize: 13,
        fontWeight: bold ? 700 : 400,
        whiteSpace: "nowrap",
        ...(sticky
          ? { position: "sticky", left: 0, background: "#181341" }
          : {}),
      }}
    >
      {children}
    </td>
  );
}