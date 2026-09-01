// src/pages/Academics.jsx
import { useState, useEffect } from "react";
import "../styles/academics.css";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const ACADEMIC_YEARS = ["2025-2026", "2024-2025", "2023-2024"];

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const monthLabel = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function gradeFor(pct) {
  if (pct >= 80) return { letter: "A", color: "#16a34a", remark: "Aad u Wanaagsan" };
  if (pct >= 70) return { letter: "B", color: "#22a05f", remark: "Aad u Wanaagsan" };
  if (pct >= 65) return { letter: "B-", color: "#65a30d", remark: "Wanaagsan" };
  if (pct >= 60) return { letter: "C+", color: "#ca8a04", remark: "Wanaagsan" };
  if (pct >= 55) return { letter: "C", color: "#d97706", remark: "Wanaagsan" };
  if (pct >= 50) return { letter: "C-", color: "#ea580c", remark: "Wanaagsan" };
  if (pct >= 40) return { letter: "D", color: "#dc2626", remark: "Ku dadaal" };
  return { letter: "F", color: "#991b1b", remark: "U baahan taageero dheeraad ah" };
}

function overallGradeFor(pct) {
  if (pct >= 80) return { letter: "A", label: "Aan (A)" };
  if (pct >= 65) return { letter: "B", label: "Fiican (B)" };
  if (pct >= 50) return { letter: "C", label: "Gudbay (C)" };
  if (pct >= 40) return { letter: "D", label: "Ku dadaal (D)" };
  return { letter: "F", label: "Dib u fadhi (F)" };
}

export default function Academics() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(ACADEMIC_YEARS[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [student, setStudent] = useState(null);
  const [results, setResults] = useState([]);

  const [showCelebration, setShowCelebration] = useState(false);
  const [feeBlocked, setFeeBlocked] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null);

  useEffect(() => {
    function handleContextMenu(e) { e.preventDefault(); }
    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();
      if (key === "f12") { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "i" || key === "j" || key === "c")) { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) { e.preventDefault(); return; }
    }
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const resetLookup = () => {
    setStudent(null);
    setResults([]);
    setStudentId("");
    setPassword("");
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
    setShowCelebration(false);
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setError("");
    setFeeBlocked(false);
    setFeeInfo(null);
    setShowCelebration(false);

    const idInput = studentId.trim();
    if (!idInput) { setError("Fadlan geli Lambarka Ardayga (Student ID)."); return; }
    if (!password.trim()) { setError("Fadlan geli Password-ka."); return; }

    const paddedId = idInput.padStart(4, "0");

    try {
      setLoading(true);

      const studentSnap = await getDoc(doc(db, "students", paddedId));
      if (!studentSnap.exists()) {
        setError("Lambarka Ardayga lama helin. Fadlan hubi oo isku day mar kale.");
        setLoading(false);
        return;
      }

      const studentData = studentSnap.data();

      if (String(studentData.parentPassword || "") !== password.trim()) {
        setError("Password-ku waa khalad. Fadlan isku day mar kale.");
        setLoading(false);
        return;
      }

      if (studentData.feeType !== "Free") {
        const monthKey = currentMonthKey();
        const paymentDocId = `${paddedId}_${monthKey}`;
        const paymentSnap = await getDoc(doc(db, "payments", paymentDocId));

        const monthlyFee = Number(studentData.monthlyFee || 0);
        const paidAmount = paymentSnap.exists() ? Number(paymentSnap.data().paidAmount || 0) : 0;
        const remaining = Math.max(monthlyFee - paidAmount, 0);
        const isFullyPaid = paymentSnap.exists() && paymentSnap.data().status === "Paid" && remaining <= 0;

        if (!isFullyPaid) {
          setFeeBlocked(true);
          setFeeInfo({
            monthlyFee,
            paidAmount,
            remaining,
            monthLabel: monthLabel(monthKey),
          });
          setLoading(false);
          return;
        }
      }

      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("studentId", "==", paddedId))
      );

      const subjectRows = resultsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.subject && String(r.subject).trim() !== "");

      const bySubject = {};
      subjectRows.forEach((r) => {
        const key = String(r.subject).toLowerCase();
        const existing = bySubject[key];
        const rTime = r.updatedAt?.seconds || 0;
        const eTime = existing?.updatedAt?.seconds || 0;
        if (!existing || rTime >= eTime) {
          bySubject[key] = r;
        }
      });

      const combined = Object.values(bySubject).sort((a, b) => {
        const aMax = Number(a.maxMarks) || 100;
        const bMax = Number(b.maxMarks) || 100;
        const aPct = aMax > 0 ? (Number(a.marks) || 0) / aMax : 0;
        const bPct = bMax > 0 ? (Number(b.marks) || 0) / bMax : 0;
        return bPct - aPct;
      });

      setStudent({ ...studentData, studentId: paddedId });
      setResults(combined);

      if (combined.length === 0) {
        setError("Ardaygan weli natiijo lagama helin xilligan la doortay. Fadlan la xiriir maamulka.");
      } else {
        const tMarks = combined.reduce((s, r) => s + (Number(r.marks) || 0), 0);
        const tMax = combined.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);
        const avg = tMax > 0 ? (tMarks / tMax) * 100 : 0;
        if (avg >= 65) setShowCelebration(true);
      }
    } catch (err) {
      console.error(err);
      setError("Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setLoading(false);
    }
  };

  const totalMarks = results.reduce((sum, r) => sum + (Number(r.marks) || 0), 0);
  const totalMax = results.reduce((sum, r) => sum + (Number(r.maxMarks) || 0), 0);
  const averagePct = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  const overall = overallGradeFor(averagePct);
  const headerMax = results.reduce((max, r) => Math.max(max, Number(r.maxMarks) || 0), 0) || 100;

  return (
    <div className="aca-page">
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="AL - ISRA School logo" />
          <div className="brand-text">
            <span className="brand-name">AL - ISRA SCHOOL</span>
            <span className="brand-tagline">AL - ISRA PRIMARY &amp; SECONDARY SCHOOL</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={"home-nav-link" + (l.to === "/academics" ? " active" : "")}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap">
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">👤</span>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <section className="aca-hero">
        <div className="aca-hero-badge">Academics</div>
        <h1 className="aca-hero-title">Check Student Results</h1>
        <p className="aca-hero-sub">
          Enter the Student ID and password to view every subject result for the selected academic year.
        </p>
      </section>

      <div className="aca-content">
        <div className="aca-lookup-card">
          <h2 className="aca-lookup-title">Tira-taxaneha Ardeyga</h2>
          <p className="aca-lookup-sub">U gudub aragtida natiijadaada — geli lambarkaaga iyo password-kaaga.</p>

          <form onSubmit={handleLookup}>
            <div className="aca-lookup-grid">
              <div className="aca-field">
                <label>Student ID</label>
                <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. 0004" />
              </div>
              <div className="aca-field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="aca-field">
                <label>Academic Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {ACADEMIC_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="aca-lookup-btn" disabled={loading}>
              {loading ? "Sugaya..." : "U Gudub Aragtida Natiijadaada"}
            </button>

            {error && <div className="aca-error">{error}</div>}
          </form>
        </div>

        {feeBlocked && feeInfo && (
          <div className="aca-results-card">
            <div className="aca-fee-lock">
              <div className="aca-fee-lock-icon">🔒</div>
              <h3 className="aca-fee-lock-title">
                Natiijada Waa La Xiray — Fee Bishaan ({feeInfo.monthLabel})
              </h3>
              <p className="aca-fee-lock-text">
                Ardaygan wali waxaa lagu leeyahay lacagta dugsiga bishan <strong>${feeInfo.remaining.toFixed(2)}</strong> oo aan la bixin.
              </p>
            </div>
          </div>
        )}

        {student && results.length > 0 && (
          <div className="aca-results-card">
            {showCelebration && (
              <div className="aca-celebrate-banner">
                <div className="aca-celebrate-banner-inner">
                  <div className="aca-celebrate-trophy">🏆</div>
                  <div className="aca-celebrate-banner-text">
                    <h3 className="aca-celebrate-title">Hambalyo!</h3>
                    <p className="aca-celebrate-sub">Horumar Wacan!</p>
                    <p className="aca-celebrate-text">
                      {student?.fullName || "Ardaygan"}, waxaad gaadhay celceliska <strong>{averagePct.toFixed(1)}%</strong> — waxaad ka mid tahay ardayda ugu fiican!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="aca-student-banner">
              <div className="aca-student-info">
                <span className="aca-student-name">{student.fullName || "—"}</span>
                <span className="aca-student-meta">
                  Student ID: {student.studentId} &nbsp;•&nbsp; Class: {student.className || "—"} &nbsp;•&nbsp; {year}
                </span>
              </div>
              <button className="aca-logout-btn" onClick={resetLookup}>Log Out</button>
            </div>

            <div className="aca-table-wrap">
              <table className="aca-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Marks (out of {headerMax})</th>
                    <th>Grade</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const max = Number(r.maxMarks) || 100;
                    const marks = Number(r.marks) || 0;
                    const pct = max > 0 ? (marks / max) * 100 : 0;
                    const g = gradeFor(pct);
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, textTransform: "capitalize" }}>{r.subject}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span>{pct.toFixed(1)}</span>
                            <div className="aca-bar-track">
                              <div
                                className="aca-bar-fill"
                                style={{ width: `${Math.min(pct, 100)}%`, background: g.color }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="aca-grade-dot" style={{ color: g.color }}>{g.letter}</span>
                        </td>
                        <td>{g.remark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* HOOS KA EEG: WRAPPER KA CUSUB EE WAX KASTA KALA SAARAYA */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                rowGap: "18px",
                width: "100%",
                maxWidth: "360px",
                margin: "30px auto 0 auto",
                textAlign: "center",
                padding: "20px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0"
              }}
            >
              <div style={{ display: "block" }}>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Total Marks
                </div>
                <div style={{ fontSize: "22px", color: "#0f172a", fontWeight: "800" }}>
                  {totalMarks.toFixed(0)} / {totalMax.toFixed(0)}
                </div>
              </div>

              <div style={{ display: "block" }}>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Average Percentage
                </div>
                <div style={{ fontSize: "22px", color: "#0f172a", fontWeight: "800" }}>
                  {averagePct.toFixed(1)}%
                </div>
              </div>

              <div style={{ display: "block" }}>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Overall Grade
                </div>
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: "800",
                    color: overall.letter === "F" ? "#dc2626" : "#16a34a"
                  }}
                >
                  {overall.label}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="AL - ISRA School logo" />
          <div>
            <div className="footer-school-name">AL - ISRA SCHOOL</div>
            <div className="footer-school-tagline">AL - ISRA PRIMARY &amp; SECONDARY SCHOOL</div>
          </div>
        </div>
      </footer>
    </div>
  );
}