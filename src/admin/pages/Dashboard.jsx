// src/admin/pages/Dashboard.jsx
//admind dashboard.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  IdCard,
  Eye,
  ChevronRight,
  CalendarDays,
  CalendarCheck,
  BookOpen,
  Users,
  UserPlus,
  UserCheck,
  School,
  CircleDollarSign,
  Building2,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  MapPin,
  ClipboardList,
  Megaphone,
  DollarSign,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  FileText,
} from "lucide-react";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import SendSmsModal from "../components/SendSmsModal";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CLASS_COLORS = ["#6D5DF0", "#f59e0b", "#22c55e", "#c084fc", "#ef4444", "#0ea5e9"];

// Compares docs created in the current calendar month vs the previous one,
// using each doc's createdAt timestamp. Returns null when there isn't
// enough createdAt data to compute a meaningful percentage (so the UI can
// hide the badge instead of showing a made-up number).
function computeMonthGrowth(docsList) {
  const withDates = docsList.filter((d) => d.createdAt?.seconds);
  if (withDates.length === 0) return null;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const lastMonthStart =
    new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime() / 1000;

  const thisMonthCount = withDates.filter((d) => d.createdAt.seconds >= thisMonthStart).length;
  const lastMonthCount = withDates.filter(
    (d) => d.createdAt.seconds >= lastMonthStart && d.createdAt.seconds < thisMonthStart
  ).length;

  if (lastMonthCount === 0) {
    return thisMonthCount > 0 ? 100 : 0;
  }
  return Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
}

// Cumulative totals at the end of each of the last `months` months, built
// from real createdAt seconds. Docs without a createdAt are counted in every
// point (they exist, we just don't know when they were added), so the last
// point always equals the real total.
function monthlyCumulativeSeries(secondsList, undatedCount = 0, months = 8) {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime() / 1000;
    out.push(secondsList.filter((s) => s < end).length + undatedCount);
  }
  return out;
}

function toDateObj(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (v.seconds) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(d) {
  if (!d) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h > 1 ? "s" : ""} ago`;
  }
  if (diff < 86400 * 7) {
    const dd = Math.floor(diff / 86400);
    return `${dd} day${dd > 1 ? "s" : ""} ago`;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Formats a Firestore Timestamp / Date / date-like value into just the
// time portion (e.g. "08:32 AM"), for showing on the shift tracker card.
function formatTimeOnly(v) {
  if (!v) return "—";
  const d = v.toDate ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShiftDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const cardStyle = {
  background: "var(--ai-card)",
  borderRadius: 18,
  padding: "20px 22px",
  boxShadow: "var(--ai-shadow)",
  border: "1px solid var(--ai-border)",
  minWidth: 0,
};

const emptyText = { fontSize: 13, color: "var(--ai-soft)", margin: 0 };

function CardHeader({ title, right, icon: Icon, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {Icon && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: `${color}1f`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={17} color={color} />
          </div>
        )}
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ai-text)" }}>{title}</h3>
      </div>
      {right}
    </div>
  );
}

function ViewAll({ onClick }) {
  return (
    <span
      onClick={onClick}
      style={{ fontSize: 13, color: "#2563eb", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
    >
      View All
    </span>
  );
}

function Sparkline({ data, color, id }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatCard({ id, title, value, icon: Icon, color, tint, growth, growthSuffix = "%", spark, onClick }) {
  const up = growth === null || growth >= 0;
  return (
    <div
      className="ai-lift"
      onClick={onClick}
      style={{
        ...cardStyle,
        padding: "18px 18px 12px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg, var(--ai-card) 45%, ${tint})`,
      }}
    >
      {/* faint large icon in the background */}
      <Icon
        size={82}
        color={color}
        style={{ position: "absolute", right: 14, top: 58, opacity: 0.07, pointerEvents: "none" }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, position: "relative" }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: `${color}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={27} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ai-text)", lineHeight: 1.15 }}>{value}</div>
          <div style={{ fontSize: 15, color: "var(--ai-muted)", marginTop: 2 }}>{title}</div>
        </div>
        <MoreVertical size={18} color="var(--ai-soft)" />
      </div>

      <div style={{ marginTop: 12, position: "relative" }}>
        {growth !== null ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14.5,
              fontWeight: 700,
              color: up ? "#16a34a" : "#dc2626",
            }}
          >
            {up ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            {growth}
            {growthSuffix} this month
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--ai-soft)" }}>—</span>
        )}
      </div>

      <div style={{ height: 44, marginTop: 6, position: "relative" }}>
        {spark.length > 0 && <Sparkline data={spark} color={color} id={`sp-${id}`} />}
      </div>
    </div>
  );
}

function OverviewTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (row.total == null) return null;
  return (
    <div
      style={{
        background: "var(--ai-card)",
        border: "1px solid var(--ai-border)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "var(--ai-shadow)",
        fontSize: 12,
        color: "var(--ai-text)",
      }}
    >
      <div style={{ color: "var(--ai-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
        New: {row.newCount}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginTop: 2 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />
        Total: {row.total}
      </div>
    </div>
  );
}

function MiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ai-text)", marginBottom: 10, textAlign: "center" }}>
        {monthLabel}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 10.5, color: "var(--ai-soft)", textAlign: "center", marginBottom: 4 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((d, i) => (
          <div
            key={i}
            style={{
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              borderRadius: "50%",
              color: d === today ? "#fff" : d ? "var(--ai-text)" : "transparent",
              background: d === today ? "#2563eb" : "transparent",
              fontWeight: d === today ? 800 : 500,
            }}
          >
            {d || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

const selectStyle = {
  height: 38,
  borderRadius: 10,
  border: "1px solid var(--ai-border)",
  background: "var(--ai-input)",
  color: "var(--ai-text)",
  fontSize: 13,
  fontWeight: 600,
  padding: "0 12px",
  cursor: "pointer",
  outline: "none",
  flexShrink: 0,
};

const EVENT_STYLES = {
  Exam: { color: "#16a34a", bg: "rgba(22,163,74,0.12)", box: "rgba(37,99,235,0.08)", num: "#2563eb" },
  Holiday: { color: "#db2777", bg: "rgba(219,39,119,0.12)", box: "rgba(219,39,119,0.08)", num: "#db2777" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [teachersCount, setTeachersCount] = useState(0);
  const [parentsCount, setParentsCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [cashiersCount, setCashiersCount] = useState(0);
  const [classBreakdown, setClassBreakdown] = useState([]);
  const [feeStats, setFeeStats] = useState({ total: 0, collected: 0, pending: 0 });
  const [teachersList, setTeachersList] = useState([]);
  const [examsByClass, setExamsByClass] = useState([]);
  const [resultsSummary, setResultsSummary] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [attendanceCard, setAttendanceCard] = useState({ rate: null, growth: null, spark: [] });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [todaysShifts, setTodaysShifts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sparks, setSparks] = useState({ students: [], teachers: [], cashiers: [], classes: [] });
  const [growth, setGrowth] = useState({
    students: null,
    teachers: null,
    cashiers: null,
    parents: null,
    classes: null,
  });

  const [loading, setLoading] = useState(true);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [overviewRange, setOverviewRange] = useState("month");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsList = studentsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStudents(studentsList);

      const teachersSnap = await getDocs(collection(db, "teachers"));
      const teachersList = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachersCount(teachersList.length);

      // Build a teacherId -> name/photo lookup, reused below for the shift
      // tracker card so it can show who's clocked in without extra reads.
      const teachersById = {};
      teachersList.forEach((t) => {
        teachersById[t.id] = t;
      });

      // Ardayda lacag bixiya (feeType = "Paid") — kuwan ayaa ah kuwa cashier-ku
      // lacagta ka qaado. Ardayda "Free" ah lagama xisaabinayo lacag.
      const isFreeStudent = (s) =>
        String(s.feeType || "").trim().toLowerCase() === "free";
      const paidStudentsList = studentsList.filter((s) => !isFreeStudent(s));
      setCashiersCount(paidStudentsList.length);

      // Waalidiinta — waxaa laga xisaabiyaa parentPhone-ka ardayda. Lambarka
      // waa la nadiifiyaa (meelaha bannaan, +252 / 252 / 0 hore) si isla
      // waalidka hal mar keliya loogu tiriyo, xitaa haddii qaab kale loo qoray.
      const normalizePhone = (phone) => {
        let digits = String(phone || "").replace(/\D/g, "");
        if (digits.startsWith("252")) digits = digits.slice(3);
        digits = digits.replace(/^0+/, "");
        return digits;
      };
      const uniqueParentPhones = new Set(
        studentsList
          .map((s) => normalizePhone(s.parentPhone))
          .filter((phone) => phone !== "")
      );
      setParentsCount(uniqueParentPhones.size);

      // Class breakdown (for pie chart)
      const classCounts = {};
      studentsList.forEach((s) => {
        const cls = s.className && s.className.trim() !== "" ? s.className : null;
        if (cls) classCounts[cls] = (classCounts[cls] || 0) + 1;
      });
      const breakdown = Object.entries(classCounts).map(([name, count], i) => ({
        name,
        value: count,
        color: CLASS_COLORS[i % CLASS_COLORS.length],
      }));
      setClassBreakdown(breakdown);
      setClassesCount(breakdown.length);

      // Growth badges — computed from real createdAt timestamps, month over
      // month. null means "not enough data", which hides the badge in the UI
      // instead of showing a fake percentage.
      setGrowth({
        students: computeMonthGrowth(studentsList),
        teachers: computeMonthGrowth(teachersList),
        cashiers: computeMonthGrowth(paidStudentsList),
        parents: null, // parents aren't a real collection with createdAt — no reliable growth signal
        classes: null, // classes are derived from student.className, not their own dated docs
      });

      // Sparklines on the stat cards — cumulative totals over the last 8
      // months, built only from real createdAt timestamps.
      const secs = (list) => list.map((d) => d.createdAt?.seconds).filter(Boolean);
      const undated = (list) => list.length - secs(list).length;
      // A class "appears" the first time a student with that className was
      // registered.
      const classFirstSeen = {};
      studentsList.forEach((s) => {
        const k = (s.className || "").trim();
        if (!k) return;
        const t = s.createdAt?.seconds || null;
        if (!(k in classFirstSeen)) classFirstSeen[k] = t;
        else if (t && (classFirstSeen[k] === null || t < classFirstSeen[k])) classFirstSeen[k] = t;
      });
      const classVals = Object.values(classFirstSeen);
      setSparks({
        students: monthlyCumulativeSeries(secs(studentsList), undated(studentsList)),
        teachers: monthlyCumulativeSeries(secs(teachersList), undated(teachersList)),
        cashiers: monthlyCumulativeSeries(secs(paidStudentsList), undated(paidStudentsList)),
        classes: monthlyCumulativeSeries(classVals.filter(Boolean), classVals.filter((v) => !v).length),
      });

      // Fee stats (This Month):
      // - Total Fees: monthlyFee-ka ardayda Paid ah oo keliya (Free lama xisaabinayo)
      // - Collected: rasiidhada dhabta ah ee "receipts" (paidAmount) ee bishan
      // - Pending: Total - Collected
      const receiptsSnap = await getDocs(collection(db, "receipts"));
      const receiptsList = receiptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const nowFee = new Date();
      const feeMonthStart = new Date(nowFee.getFullYear(), nowFee.getMonth(), 1).getTime() / 1000;
      const feeMonthEnd = new Date(nowFee.getFullYear(), nowFee.getMonth() + 1, 1).getTime() / 1000;

      const collected = receiptsList
        .filter((r) => {
          const secs = r.paidAt?.seconds || r.createdAt?.seconds;
          return secs && secs >= feeMonthStart && secs < feeMonthEnd;
        })
        .reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);

      const expectedTotal = paidStudentsList.reduce(
        (sum, s) => sum + (Number(s.monthlyFee) || 0),
        0
      );

      setFeeStats({
        total: expectedTotal,
        collected,
        pending: Math.max(expectedTotal - collected, 0),
      });

      // Full teachers list (for the Teachers table on the dashboard)
      setTeachersList(
        teachersList.map((t) => ({
          id: t.id,
          fullName: t.fullName || t.name || t.id,
          subject: t.subject || "—",
          username: t.username || t.id,
        }))
      );

      // Exams grouped by class
      const examsSnap = await getDocs(collection(db, "exams"));
      const examsList = examsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const examsByClassMap = {};
      examsList.forEach((e) => {
        const cls = e.className || e.classId || "Unassigned";
        if (!examsByClassMap[cls]) examsByClassMap[cls] = [];
        examsByClassMap[cls].push(e);
      });
      const examsByClassArr = Object.entries(examsByClassMap)
        .map(([className, list]) => ({ className, exams: list }))
        .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));
      setExamsByClass(examsByClassArr);

      // Results — combine all marks per student into a single row per
      // student with a computed average (sum of marks / sum of maxMarks),
      // like a spreadsheet summary row.
      const resultsSnap = await getDocs(collection(db, "results"));
      const resultsList = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const byStudent = {};
      resultsList.forEach((r) => {
        const key = r.studentId || r.studentName || r.id;
        if (!byStudent[key]) {
          byStudent[key] = {
            studentId: r.studentId || "",
            studentName: r.studentName || "Unknown",
            className: r.className || "",
            subjects: [],
            totalMarks: 0,
            totalMax: 0,
          };
        }
        const marks = Number(r.marks) || 0;
        const maxMarks = Number(r.maxMarks) || 0;
        byStudent[key].subjects.push({ subject: r.subject || "—", marks, maxMarks });
        byStudent[key].totalMarks += marks;
        byStudent[key].totalMax += maxMarks;
      });
      const resultsSummary = Object.values(byStudent).map((s) => ({
        ...s,
        average: s.totalMax > 0 ? Math.round((s.totalMarks / s.totalMax) * 100) : 0,
      }));
      setResultsSummary(resultsSummary);

      // Attendance overview — today's real attendance records from the
      // "attendance" collection (status field: Present / Absent / Late).
      const attendanceSnap = await getDocs(collection(db, "attendance"));
      const attendanceList = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todayStr = new Date().toISOString().slice(0, 10);
      const recordDay = (a) => {
        if (a.date) return String(a.date).slice(0, 10);
        if (a.createdAt?.seconds) {
          return new Date(a.createdAt.seconds * 1000).toISOString().slice(0, 10);
        }
        return "";
      };
      const isPresent = (a) => (a.status || "").toLowerCase() === "present";
      const todaysRecords = attendanceList.filter((a) => recordDay(a) === todayStr);
      const present = todaysRecords.filter(isPresent).length;
      const absent = todaysRecords.filter((a) => (a.status || "").toLowerCase() === "absent").length;
      const late = todaysRecords.filter((a) => (a.status || "").toLowerCase() === "late").length;
      setAttendanceStats({ present, absent, late, total: todaysRecords.length });

      // Attendance stat card — present-rate per calendar month over the last
      // 8 months (real records only). The card shows today's rate, falling
      // back to this month's rate, and the change vs last month in points.
      const monthRate = (ym) => {
        const recs = attendanceList.filter((a) => recordDay(a).slice(0, 7) === ym);
        return recs.length ? pct(recs.filter(isPresent).length, recs.length) : null;
      };
      const ymOf = (offset) => {
        const d = new Date();
        const m = new Date(d.getFullYear(), d.getMonth() - offset, 1);
        return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      };
      const attSpark = [];
      for (let i = 7; i >= 0; i--) attSpark.push(monthRate(ymOf(i)));
      const thisMonthRate = attSpark[7];
      const lastMonthRate = attSpark[6];
      setAttendanceCard({
        rate: todaysRecords.length ? pct(present, todaysRecords.length) : thisMonthRate,
        growth: thisMonthRate !== null && lastMonthRate !== null ? thisMonthRate - lastMonthRate : null,
        spark: attSpark.some((v) => v !== null) ? attSpark : [],
      });

      // Upcoming events — real exam docs with a future date, plus real
      // holidays (if the "holidays" collection has dated docs), soonest first.
      const now2 = new Date();
      now2.setHours(0, 0, 0, 0);
      const examEvents = examsList
        .filter((e) => e.date)
        .map((e) => ({
          id: `ex-${e.id}`,
          type: "Exam",
          title: e.examName || "Exam",
          dateObj: new Date(e.date),
          time: e.startTime ? `${e.startTime}${e.endTime ? ` - ${e.endTime}` : ""}` : "",
          place: e.room || e.venue || (e.className ? `Class ${e.className}` : "All Classes"),
        }));

      let holidayEvents = [];
      try {
        const holidaysSnap = await getDocs(collection(db, "holidays"));
        holidayEvents = holidaysSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .map((h) => ({
            id: `ho-${h.id}`,
            type: "Holiday",
            title: h.title || h.name || h.holidayName || "Holiday",
            dateObj: toDateObj(h.date || h.startDate || h.fromDate),
            time: "All Day",
            place: "",
          }))
          .filter((h) => h.dateObj);
      } catch (e) {
        console.log(e);
      }

      const events = [...examEvents, ...holidayEvents]
        .filter((e) => e.dateObj && !isNaN(e.dateObj.getTime()) && e.dateObj >= now2)
        .sort((a, b) => a.dateObj - b.dateObj)
        .slice(0, 4);
      setUpcomingEvents(events);

      // Notice board — real broadcast messages from admin, most recent first
      const messagesSnap = await getDocs(collection(db, "messages"));
      const messagesList = messagesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.scope === "broadcast" || m.audienceGroup === "broadcast");
      messagesList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotices(messagesList.slice(0, 4));

      // Teacher Shifts — every shift doc whose clockInAt falls on today's
      // calendar date, newest first, enriched with the teacher's name/photo
      // (falling back to whatever the shift doc itself stored).
      const shiftsSnap = await getDocs(collection(db, "shifts"));
      const shiftsList = shiftsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todaysShiftsList = shiftsList
        .filter((s) => {
          const d = s.clockInAt?.toDate ? s.clockInAt.toDate() : new Date(s.clockInAt);
          if (isNaN(d.getTime())) return false;
          return d.toISOString().slice(0, 10) === todayStr;
        })
        .map((s) => {
          const teacher = teachersById[s.teacherId];
          return {
            ...s,
            resolvedName: teacher?.fullName || s.teacherName || "Macalin aan la aqoon",
            resolvedPhoto: teacher?.photoUrl || teacher?.teacherPhoto || "",
          };
        })
        .sort((a, b) => {
          const at = a.clockInAt?.seconds || 0;
          const bt = b.clockInAt?.seconds || 0;
          return bt - at;
        });
      setTodaysShifts(todaysShiftsList);

      // Recent Activities — a merged, newest-first feed built only from the
      // real docs already loaded above (no extra reads, no fake entries).
      const acts = [];
      studentsList.forEach((s) => {
        const d = toDateObj(s.createdAt);
        if (!d) return;
        acts.push({
          key: `st-${s.id}`,
          type: "student",
          title: "New student registered",
          sub: s.fullName || s.studentName || s.name || (s.className ? `Class ${s.className}` : "Arday cusub"),
          date: d,
        });
      });
      teachersList.forEach((t) => {
        const d = toDateObj(t.createdAt);
        if (!d) return;
        acts.push({
          key: `te-${t.id}`,
          type: "teacher",
          title: "New teacher added",
          sub: t.fullName || t.name || t.username || t.id,
          date: d,
        });
      });
      receiptsList.forEach((r) => {
        const d = toDateObj(r.paidAt || r.createdAt);
        if (!d) return;
        acts.push({
          key: `rc-${r.id}`,
          type: "payment",
          title: "Payment received",
          sub: [`$${(Number(r.paidAmount) || 0).toLocaleString()}`, r.studentName || ""].filter(Boolean).join(" • "),
          date: d,
        });
      });
      const attGroups = {};
      attendanceList.forEach((a) => {
        const d = toDateObj(a.createdAt);
        if (!d) return;
        const k = `${a.className || "—"}|${recordDay(a)}`;
        if (!attGroups[k]) attGroups[k] = { className: a.className, count: 0, date: d };
        attGroups[k].count += 1;
        if (d > attGroups[k].date) attGroups[k].date = d;
      });
      Object.entries(attGroups).forEach(([k, g]) => {
        acts.push({
          key: `att-${k}`,
          type: "attendance",
          title: "Attendance marked",
          sub: `${g.className ? `Class ${g.className}` : "Class —"} • ${g.count} students`,
          date: g.date,
        });
      });
      examsList.forEach((e) => {
        const d = toDateObj(e.createdAt);
        if (!d) return;
        acts.push({
          key: `exm-${e.id}`,
          type: "exam",
          title: "New exam added",
          sub: [e.examName, e.subject].filter(Boolean).join(" - ") || "Exam",
          date: d,
        });
      });
      messagesList.forEach((m) => {
        const d = toDateObj(m.createdAt);
        if (!d) return;
        acts.push({
          key: `msg-${m.id}`,
          type: "notice",
          title: "Notice sent",
          sub: m.subject || "Notice",
          date: d,
        });
      });
      shiftsList.forEach((s) => {
        const d = toDateObj(s.clockInAt);
        if (!d) return;
        const teacher = teachersById[s.teacherId];
        acts.push({
          key: `sh-${s.id}`,
          type: "shift",
          title: "Teacher clocked in",
          sub: teacher?.fullName || s.teacherName || "Macalin aan la aqoon",
          date: d,
        });
      });
      acts.sort((a, b) => b.date - a.date);
      setActivities(acts.slice(0, 5));
    } catch (error) {
      console.error("Khalad ayaa dhacay markii xogta Dashboard laga soo qaadanayay:", error);
    } finally {
      setLoading(false);
    }
  }

  // Student Overview — month view: new registrations per week of the
  // current month + running total of all students at the end of each week.
  const monthOverviewData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthLabel = now.toLocaleDateString("en-GB", { month: "short" });
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build week buckets: 1-7, 8-14, 15-21, 22-28, 29-end
    const weekStarts = [1, 8, 15, 22, 29].filter((d) => d <= daysInMonth);
    const buckets = weekStarts.map((start, i) => {
      const end = i + 1 < weekStarts.length ? weekStarts[i + 1] - 1 : daysInMonth;
      return { start, end, label: `${monthLabel} ${start}` };
    });

    const dated = students.filter((s) => s.createdAt?.seconds);
    const undatedCount = students.length - dated.length;

    return buckets.map((b) => {
      const endTs = new Date(year, month, b.end + 1).getTime() / 1000;
      const future = new Date(year, month, b.start) > now;
      const newCount = dated.filter((s) => {
        const d = new Date(s.createdAt.seconds * 1000);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() >= b.start && d.getDate() <= b.end;
      }).length;
      return {
        label: b.label,
        newCount: future ? null : newCount,
        total: future ? null : dated.filter((s) => s.createdAt.seconds < endTs).length + undatedCount,
      };
    });
  }, [students]);

  // Year view: new registrations per month of the current year + total
  // students on the books at the end of each month (future months empty).
  const yearOverviewData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const dated = students.filter((s) => s.createdAt?.seconds);
    const undatedCount = students.length - dated.length;
    return Array.from({ length: 12 }, (_, m) => {
      const label = new Date(year, m, 1).toLocaleDateString("en-GB", { month: "short" });
      if (m > now.getMonth()) return { label, newCount: null, total: null };
      const start = new Date(year, m, 1).getTime() / 1000;
      const end = new Date(year, m + 1, 1).getTime() / 1000;
      return {
        label,
        newCount: dated.filter((s) => s.createdAt.seconds >= start && s.createdAt.seconds < end).length,
        total: dated.filter((s) => s.createdAt.seconds < end).length + undatedCount,
      };
    });
  }, [students]);

  const overviewData = overviewRange === "year" ? yearOverviewData : monthOverviewData;

  const feePercent =
    feeStats.total > 0 ? Math.round((feeStats.collected / feeStats.total) * 100) : 0;

  const activeShiftsCount = todaysShifts.filter((s) => s.status === "open").length;

  // Academic year label (Sep → Aug): e.g. Sep 2026 → "2026 - 2027"
  const academicYear = (() => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  })();

  const v = (n) => (loading ? "..." : n);

  const activityIcon = {
    student: { icon: UserPlus, color: "#16a34a" },
    teacher: { icon: UserCheck, color: "#7c3aed" },
    payment: { icon: DollarSign, color: "#f59e0b" },
    attendance: { icon: ClipboardList, color: "#2563eb" },
    exam: { icon: FileText, color: "#ea580c" },
    notice: { icon: Megaphone, color: "#db2777" },
    shift: { icon: Clock, color: "#0891b2" },
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--ai-bg)",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <Sidebar />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "14px 24px 0" }}>
          <Topbar />
        </div>

        <div className="ai-page" style={{ padding: "20px 24px 30px" }}>
          {/* ================= HERO ================= */}
          <div
            className="ai-hero"
            style={{
              borderRadius: 22,
              padding: "36px 36px 34px",
              marginBottom: 20,
              color: "#fff",
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(100deg,#0a2f8f 0%,#0f46c7 40%,rgba(15,70,199,0.7) 60%,rgba(15,70,199,0.05) 100%), url(/school-hero.jpg) right center / cover no-repeat, #1552d8",
              boxShadow: "0 14px 34px rgba(15,70,199,0.25)",
            }}
          >
            {/* decorative shapes */}
            <div
              style={{
                position: "absolute",
                left: -60,
                bottom: -70,
                width: 200,
                height: 160,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(34,197,94,0.6), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "46%",
                top: -120,
                width: 360,
                height: 360,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                pointerEvents: "none",
              }}
            />

            <div className="ai-hero-content" style={{ position: "relative", maxWidth: "62%" }}>
              <p style={{ margin: "0 0 6px", fontSize: 18, opacity: 0.95, fontWeight: 500 }}>Welcome back,</p>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 2.5vw, 36px)",
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: "0.005em",
                }}
              >
                AL - ISRA <span style={{ color: "#facc15" }}>PRIMARY & SECONDARY</span> SCHOOL!
              </h1>
              <p style={{ margin: "12px 0 24px", fontSize: 17, opacity: 0.95 }}>
                Smart Management, Better Education, Brighter Future.
              </p>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="ai-hero-btn"
                  onClick={() => navigate("/admin/reports")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 24px",
                    borderRadius: 16,
                    border: "none",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: 14.5,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                  }}
                >
                  <Eye size={19} />
                  Explore Dashboard
                  <ChevronRight size={18} />
                </button>

                <button
                  className="ai-hero-btn"
                  onClick={() => navigate("/admin/exam-cards")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "15px 22px",
                    borderRadius: 16,
                    border: "1.5px solid rgba(255,255,255,0.45)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14.5,
                    cursor: "pointer",
                  }}
                >
                  <IdCard size={18} />
                  Exam Cards
                </button>

                {[
                  { icon: CalendarDays, label: "Academic Year", value: academicYear },
                  { icon: BookOpen, label: "Total Classes", value: loading ? "..." : `${classesCount} Classes` },
                  { icon: Users, label: "Parents", value: loading ? "..." : `${parentsCount} Parents` },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 14px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      <Icon size={20} />
                      <div style={{ lineHeight: 1.25 }}>
                        <div style={{ fontSize: 10.5, opacity: 0.8 }}>{c.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Handwritten quote */}
            <div
              className="ai-hero-quote"
              style={{
                position: "absolute",
                right: 34,
                top: 26,
                fontFamily: "'Caveat', cursive",
                fontSize: 30,
                lineHeight: 1.05,
                color: "#fff",
                textAlign: "right",
                transform: "rotate(-8deg)",
                textShadow: "0 2px 10px rgba(0,0,0,0.35)",
              }}
            >
              Education
              <br />
              is the key to
              <br />
              a brighter future
              <div
                style={{
                  width: 110,
                  height: 4,
                  borderRadius: 4,
                  background: "#facc15",
                  marginLeft: "auto",
                  marginTop: 6,
                }}
              />
            </div>
          </div>

          {smsModalOpen && <SendSmsModal onClose={() => setSmsModalOpen(false)} />}

          {/* ================= STAT CARDS ================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <StatCard
              id="students"
              title="Students"
              value={v(students.length)}
              icon={Users}
              color="#16a34a"
              tint="rgba(22,163,74,0.07)"
              growth={growth.students}
              spark={sparks.students}
              onClick={() => navigate("/admin/students")}
            />
            <StatCard
              id="teachers"
              title="Teachers"
              value={v(teachersCount)}
              icon={UserCheck}
              color="#7c3aed"
              tint="rgba(124,58,237,0.07)"
              growth={growth.teachers}
              spark={sparks.teachers}
              onClick={() => navigate("/admin/teachers")}
            />
            <StatCard
              id="cashiers"
              title="Cashiers"
              value={v(cashiersCount)}
              icon={CircleDollarSign}
              color="#ea8a0c"
              tint="rgba(245,158,11,0.09)"
              growth={growth.cashiers}
              spark={sparks.cashiers}
              onClick={() => navigate("/admin/add-cashier")}
            />
            <StatCard
              id="classes"
              title="Classes"
              value={v(classesCount)}
              icon={Building2}
              color="#2563eb"
              tint="rgba(37,99,235,0.07)"
              growth={growth.classes}
              spark={sparks.classes}
              onClick={() => navigate("/admin/classes")}
            />
            <StatCard
              id="attendance"
              title="Attendance"
              value={v(attendanceCard.rate !== null ? `${attendanceCard.rate}%` : "—")}
              icon={CalendarCheck}
              color="#e11d48"
              tint="rgba(225,29,72,0.07)"
              growth={attendanceCard.growth}
              spark={attendanceCard.spark}
              onClick={() => navigate("/admin/attendance")}
            />
          </div>

          {/* ================= OVERVIEW + ACTIVITIES + EVENTS ================= */}
          <div
            className="ai-row-3a"
            style={{ display: "grid", gridTemplateColumns: "1.45fr 1.1fr 1fr", gap: 18, marginBottom: 20 }}
          >
            {/* Student Overview */}
            <div style={cardStyle} className="ai-span">
              <CardHeader
                title="Student Overview"
                right={
                  <select
                    value={overviewRange}
                    onChange={(e) => setOverviewRange(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                }
              />
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overviewData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }} barGap={-16}>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ai-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--ai-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<OverviewTooltip />} cursor={{ fill: "rgba(37,99,235,0.05)" }} />
                    <Bar dataKey="total" barSize={16} radius={[4, 4, 0, 0]} fill="rgba(148,163,184,0.22)" />
                    <Bar dataKey="newCount" barSize={16} radius={[4, 4, 0, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 10, fontSize: 13, color: "var(--ai-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
                  New Students
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#cbd5e1" }} />
                  Total Students
                </span>
              </div>
            </div>

            {/* Recent Activities */}
            <div style={cardStyle}>
              <CardHeader title="Recent Activities" right={<ViewAll onClick={() => navigate("/admin/reports")} />} />
              {activities.length === 0 && !loading && <p style={emptyText}>Wax dhaqdhaqaaq ah lama helin.</p>}
              {activities.map((a) => {
                const meta = activityIcon[a.type];
                const Icon = meta.icon;
                return (
                  <div
                    key={a.key}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "7px 0" }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `${meta.color}1a`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} color={meta.color} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ai-text)" }}>{a.title}</div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ai-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {a.sub}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ai-soft)", flexShrink: 0 }}>{timeAgo(a.date)}</span>
                  </div>
                );
              })}
            </div>

            {/* Upcoming Events — real exams + holidays with a future date */}
            <div style={cardStyle}>
              <CardHeader title="Upcoming Events" right={<ViewAll onClick={() => navigate("/admin/exams")} />} />
              {upcomingEvents.length === 0 && !loading && <p style={emptyText}>Dhacdooyin soo socda lama helin.</p>}
              {upcomingEvents.map((e, i) => {
                const st = EVENT_STYLES[e.type];
                return (
                  <div
                    key={e.id}
                    className="ai-row-hover"
                    onClick={() => navigate(e.type === "Holiday" ? "/admin/holidays" : "/admin/exams")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 4px",
                      borderTop: i ? "1px solid var(--ai-border)" : "none",
                      cursor: "pointer",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 12,
                        background: st.box,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        lineHeight: 1.1,
                      }}
                    >
                      <span style={{ fontSize: 19, fontWeight: 900, color: st.num }}>
                        {String(e.dateObj.getDate()).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 11.5, color: st.num, fontWeight: 600 }}>
                        {e.dateObj.toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ai-text)" }}>{e.title}</div>
                      {e.time && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ai-muted)" }}>
                          <Clock size={11} /> {e.time}
                        </div>
                      )}
                      {e.place && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ai-muted)" }}>
                          <MapPin size={11} /> {e.place}
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        background: st.bg,
                        color: st.color,
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "4px 12px",
                        borderRadius: 20,
                        flexShrink: 0,
                      }}
                    >
                      {e.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= FEES + ATTENDANCE + NOTICES + CALENDAR ================= */}
          <div
            className="ai-row-4"
            style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 20 }}
          >
            {/* Fee Collection */}
            <div style={cardStyle}>
              <CardHeader
                title="Fee Collection"
                icon={PieIcon}
                color="#6D5DF0"
                right={<span style={{ fontSize: 12, color: "#6D5DF0", fontWeight: 700 }}>This Month</span>}
              />
              <div style={{ height: 150, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Collected", value: feeStats.collected || 1 },
                        { name: "Pending", value: feeStats.pending || 0 },
                      ]}
                      innerRadius={52}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      <Cell fill="#6D5DF0" />
                      <Cell fill="rgba(109,93,240,0.18)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-50%)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: "var(--ai-text)" }}>{feePercent}%</div>
                  <div style={{ fontSize: 11, color: "var(--ai-muted)" }}>Collected</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                {[
                  { label: "Total Fees", value: feeStats.total, color: "#6D5DF0" },
                  { label: "Collected", value: feeStats.collected, color: "#22c55e" },
                  { label: "Pending", value: feeStats.pending, color: "#ef4444" },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                      marginBottom: 7,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ai-muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                      {row.label}
                    </span>
                    <span style={{ fontWeight: 800, color: "var(--ai-text)" }}>${row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Overview — real attendance docs for today */}
            <div style={cardStyle}>
              <CardHeader title="Attendance Today" icon={BarChart3} color="#16a34a" />
              {attendanceStats.total === 0 && !loading ? (
                <p style={emptyText}>Xogta imaanshaha maanta lama helin.</p>
              ) : (
                <>
                  <div style={{ width: 130, height: 130, margin: "0 auto", position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: attendanceStats.present },
                            { name: "Absent", value: attendanceStats.absent },
                            { name: "Late", value: attendanceStats.late },
                          ]}
                          innerRadius={45}
                          outerRadius={62}
                          paddingAngle={2}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                        >
                          <Cell fill="#16a34a" />
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ai-text)" }}>
                        {pct(attendanceStats.present, attendanceStats.total)}%
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ai-muted)" }}>Present</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13 }}>
                    {[
                      { label: "Present", value: attendanceStats.present, color: "#16a34a" },
                      { label: "Absent", value: attendanceStats.absent, color: "#ef4444" },
                      { label: "Late", value: attendanceStats.late, color: "#f59e0b" },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ai-muted)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                          {row.label}
                        </span>
                        <span style={{ fontWeight: 800, color: "var(--ai-text)" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Notice Board — driven by broadcast messages sent from admin */}
            <div style={cardStyle}>
              <CardHeader
                title="Notice Board"
                icon={Megaphone}
                color="#db2777"
                right={<ViewAll onClick={() => navigate("/admin/messages")} />}
              />
              {notices.length === 0 && !loading && <p style={emptyText}>Ogeysiisyo lama helin.</p>}
              {notices.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: "1px solid var(--ai-border)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(219,39,119,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 15,
                    }}
                  >
                    📢
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ai-text)" }}>{n.subject || "Notice"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ai-muted)" }}>
                      {n.createdAt?.seconds
                        ? new Date(n.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar — current month, today highlighted */}
            <div style={cardStyle}>
              <CardHeader title="Calendar" icon={CalendarDays} color="#2563eb" />
              <MiniCalendar />
            </div>
          </div>

          {/* ================= TEACHER SHIFTS + STUDENTS BY CLASS ================= */}
          <div className="ai-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
            {/* Teacher Shifts — today's clock-in/clock-out activity,
                pulled live from the "shifts" collection */}
            <div style={cardStyle}>
              <CardHeader
                title="Teacher Shifts (Today)"
                icon={Clock}
                color="#8B5CF6"
                right={<ViewAll onClick={() => navigate("/admin/shifts")} />}
              />

              {!loading && activeShiftsCount > 0 && (
                <div
                  style={{
                    display: "inline-block",
                    background: "rgba(34,197,94,0.12)",
                    color: "#16a34a",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: 20,
                    marginBottom: 12,
                  }}
                >
                  ● {activeShiftsCount} macalin oo hadda shift furan
                </div>
              )}

              {todaysShifts.length === 0 && !loading && (
                <p style={emptyText}>Maanta wali cid shift furan ama xiray lama helin.</p>
              )}

              {todaysShifts.slice(0, 5).map((s) => {
                const isOpen = s.status === "open";
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 0",
                      borderBottom: "1px solid var(--ai-border)",
                    }}
                  >
                    {s.resolvedPhoto ? (
                      <img
                        src={s.resolvedPhoto}
                        alt=""
                        style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "rgba(37,99,235,0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#2563eb",
                        }}
                      >
                        {(s.resolvedName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ai-text)" }}>{s.resolvedName}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ai-muted)" }}>
                        {formatTimeOnly(s.clockInAt)}
                        {" → "}
                        {isOpen ? "Weli furan" : formatTimeOnly(s.clockOutAt)}
                        {!isOpen && s.durationMs ? ` · ${formatShiftDuration(s.durationMs)}` : ""}
                      </div>
                    </div>
                    <span
                      style={{
                        background: isOpen ? "rgba(34,197,94,0.15)" : "rgba(109,93,240,0.15)",
                        color: isOpen ? "#22C55E" : "#8B5CF6",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {isOpen ? "Furan" : "Xiran"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Students by Class */}
            <div style={cardStyle}>
              <CardHeader title="Students by Class" icon={School} color="#7c3aed" />

              {classBreakdown.length === 0 && !loading && <p style={emptyText}>Fasallo lama helin.</p>}

              {classBreakdown.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                  <div style={{ width: 140, height: 140, position: "relative", flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={classBreakdown} innerRadius={42} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">
                          {classBreakdown.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%,-50%)",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--ai-text)" }}>{students.length}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ai-muted)" }}>Total</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 140 }}>
                    {classBreakdown.map((entry) => (
                      <div
                        key={entry.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ai-muted)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }} />
                          {entry.name}
                        </span>
                        <span style={{ fontWeight: 800, color: "var(--ai-text)" }}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= BANNER ================= */}
          <div
            style={{
              background: "linear-gradient(120deg,#1ea7ff,#2563eb 55%,#1d4ed8)",
              borderRadius: 18,
              padding: "22px 26px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800 }}>Let's make this year amazing! 🚀</h3>
              <p style={{ margin: 0, fontSize: 13.5, opacity: 0.9, lineHeight: 1.5 }}>
                Stay organized and keep your school running smoothly.
              </p>
            </div>
            <div style={{ fontSize: 44 }}>🏫</div>
          </div>

          {/* ================= TEACHERS LIST ================= */}
          <div style={{ ...cardStyle, marginBottom: 20, overflowX: "auto" }}>
            <CardHeader title={`Teachers (${teachersList.length})`} icon={UserCheck} color="#7c3aed" />

            {teachersList.length === 0 && !loading && <p style={emptyText}>Macalimiin lama helin.</p>}

            {teachersList.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
                <thead>
                  <tr style={{ color: "var(--ai-soft)", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Full Name</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Subject</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersList.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--ai-border)" }}>
                      <td style={{ padding: "10px 0", color: "var(--ai-text)", fontWeight: 600 }}>{t.fullName}</td>
                      <td style={{ color: "var(--ai-muted)" }}>{t.subject}</td>
                      <td style={{ color: "var(--ai-muted)" }}>{t.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ================= EXAMS BY CLASS ================= */}
          <div style={{ ...cardStyle, marginBottom: 20, overflowX: "auto" }}>
            <CardHeader title="Exams by Class" icon={ClipboardList} color="#2563eb" />

            {examsByClass.length === 0 && !loading && <p style={emptyText}>Imtixaano lama helin.</p>}

            {examsByClass.map((group) => (
              <div key={group.className} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: "#2563eb",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ background: "rgba(37,99,235,0.1)", padding: "3px 10px", borderRadius: 20, fontSize: 12 }}>
                    Class {group.className}
                  </span>
                  <span style={{ color: "var(--ai-soft)", fontWeight: 500 }}>
                    {group.exams.length} exam{group.exams.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                  <thead>
                    <tr style={{ color: "var(--ai-soft)", textAlign: "left" }}>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Exam Name</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Subject</th>
                      <th style={{ fontWeight: 600, paddingBottom: 6 }}>Max Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.exams.map((e) => (
                      <tr key={e.id} style={{ borderTop: "1px solid var(--ai-border)" }}>
                        <td style={{ padding: "8px 0", color: "var(--ai-text)", fontWeight: 600 }}>{e.examName || "—"}</td>
                        <td style={{ color: "var(--ai-muted)" }}>{e.subject || "—"}</td>
                        <td style={{ color: "var(--ai-muted)" }}>{e.maxMarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* ================= RESULTS SUMMARY ================= */}
          {/* every subject's marks combined per student, like a spreadsheet total/average column */}
          <div style={{ ...cardStyle, overflowX: "auto" }}>
            <CardHeader title="Results Summary" icon={Activity} color="#f59e0b" />

            {resultsSummary.length === 0 && !loading && <p style={emptyText}>Natiijooyin lama helin.</p>}

            {resultsSummary.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: "var(--ai-soft)", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Class</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Subjects Taken</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Total Marks</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {resultsSummary.map((s) => (
                    <tr key={s.studentId || s.studentName} style={{ borderTop: "1px solid var(--ai-border)" }}>
                      <td style={{ padding: "10px 0", color: "var(--ai-text)", fontWeight: 600 }}>{s.studentName}</td>
                      <td style={{ color: "var(--ai-muted)" }}>{s.className || "—"}</td>
                      <td style={{ color: "var(--ai-muted)" }}>{s.subjects.length}</td>
                      <td style={{ color: "var(--ai-muted)" }}>
                        {s.totalMarks} / {s.totalMax}
                      </td>
                      <td>
                        <span
                          style={{
                            background: s.average >= 50 ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.14)",
                            color: s.average >= 50 ? "#16A34A" : "#DC2626",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 20,
                          }}
                        >
                          {s.average}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
        .ai-lift { transition: transform .18s ease, box-shadow .18s ease; }
        .ai-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(15,23,42,0.10); }
        .ai-hero-btn { transition: transform .18s ease, filter .18s ease; }
        .ai-hero-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
        .ai-row-hover:hover { background: var(--ai-hover); }

        @media (max-width: 1320px) {
          .ai-row-3a { grid-template-columns: 1fr 1fr !important; }
          .ai-row-3a .ai-span { grid-column: 1 / -1; }
        }
        @media (max-width: 1200px) {
          .ai-row-4 { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 1100px) {
          .ai-row-2 { grid-template-columns: 1fr !important; }
          .ai-hero-quote { display: none; }
          .ai-hero-content { max-width: 100% !important; }
        }
        @media (max-width: 760px) {
          .ai-row-3a, .ai-row-4 { grid-template-columns: 1fr !important; }
          .ai-page { padding: 16px 14px 24px !important; }
          .ai-hero { padding: 24px 20px !important; }
        }
      `}</style>
    </div>
  );
}