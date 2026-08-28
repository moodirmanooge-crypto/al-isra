import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const isToday = (ts) => {
  if (!ts || !ts.seconds) return false;
  const d = new Date(ts.seconds * 1000);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Real enrolled students live in "students" (same collection
      // Payments.jsx reads from) — "cashier" is cashier staff accounts,
      // not students, so counting from it gave wrong totals.
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentData = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (s) =>
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );
      setStudents(studentData);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const monthKey = currentMonthKey();
    const monthPayments = payments.filter((p) => p.monthKey === monthKey);

    const todaysCollection = monthPayments
      .filter((p) => isToday(p.createdAt))
      .reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);

    const monthlyCollection = monthPayments.reduce(
      (sum, p) => sum + Number(p.paidAmount || 0),
      0
    );

    // A student counts as "Paid" for the month only if their record
    // for this monthKey has status "Paid".
    const paidStudentIds = new Set(
      monthPayments.filter((p) => p.status === "Paid").map((p) => p.studentId)
    );

    // Free students are excluded from paid/remaining counts entirely —
    // they never owe a fee, so they shouldn't inflate "remaining".
    const payableStudents = students.filter((s) => s.feeType !== "Free");

    const studentsPaid = payableStudents.filter((s) =>
      paidStudentIds.has(s.studentId)
    ).length;
    const studentsRemaining = Math.max(
      payableStudents.length - studentsPaid,
      0
    );

    return {
      todaysCollection,
      monthlyCollection,
      studentsPaid,
      studentsRemaining,
    };
  }, [students, payments]);

  const STATS = [
    {
      label: "Today's Collection",
      value: `$${stats.todaysCollection}`,
      accent: theme.colors.mint,
      icon: "💵",
    },
    {
      label: "Monthly Collection",
      value: `$${stats.monthlyCollection}`,
      accent: theme.colors.brand,
      icon: "📈",
    },
    {
      label: "Students Paid",
      value: stats.studentsPaid,
      accent: theme.colors.mint,
      icon: "✅",
    },
    {
      label: "Students Remaining",
      value: stats.studentsRemaining,
      accent: theme.colors.amber,
      icon: "⏳",
    },
  ];

  return (
    <div>
      <header style={{ marginBottom: 28 }}>
        <h1 style={styles.title}>Cashier Dashboard</h1>
        <p style={styles.subtitle}>Overview of today's payment activity</p>
      </header>

      {loading ? (
        <p style={{ color: theme.colors.inkMuted }}>Loading dashboard...</p>
      ) : (
        <div style={styles.grid}>
          {STATS.map((s) => (
            <div key={s.label} style={styles.card}>
              <div style={{ ...styles.iconWrap, background: `${s.accent}1A` }}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div style={styles.value}>{s.value}</div>
              <div style={styles.label}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 28,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    marginTop: 6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
  },
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  value: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 26,
    color: theme.colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  label: {
    color: theme.colors.inkMuted,
    fontSize: 13.5,
    marginTop: 4,
    fontWeight: 500,
  },
};