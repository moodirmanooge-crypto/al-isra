// src/cashier/Classes.jsx
//
// A second entry point onto the exact same `payments` Firestore collection
// that Payments.jsx and Reports.jsx already read/write — grouped by class,
// with real multi-month payment tracking instead of "only remembers the
// latest month."
//
// WHY THIS EXISTS: Payments.jsx always saves against *this calendar month*
// only (`payments/{studentId}_{currentMonthKey}`), and only ever reads the
// single most-recent record per student. It has no way to know which
// months are actually covered when a parent pays several months' fees at
// once — e.g. a $17/month student paying $114 has covered 6 months, and
// the system should know exactly which 6 months those are and that the
// 7th is still owed.
//
// This page adds that: every payment entered here is spread forward,
// month by month, starting from the earliest month the student has not
// yet fully paid (based on their registration month and their existing
// payment records for that studentId — pulled from the SAME `payments`
// collection Payments.jsx writes to). Each covered month is written as
// its own `payments/{studentId}_{monthKey}` doc with the exact same
// field shape Payments.jsx already uses, so Payments.jsx and Reports.jsx
// need no changes at all and stay perfectly in sync with what happens
// here.
//
// Example: student owes $17/month, has paid nothing yet, registered in
// March. Cashier enters $114 → 114 / 17 = 6 full months exactly →
// March–August all get marked Paid. Next time the cashier looks this
// student up, the next unpaid month is September. If a partial amount
// is entered that doesn't complete a month (say $124 when 7 months are
// still owed: 7×17=119, remainder 5), the 7th month gets a partial
// "Not Paid" record (paidAmount 5, remaining 12) and the 8th month
// onward stays untouched — exactly mirroring how Payments.jsx already
// represents a partially-paid month.
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import ReceiptModal from "./ReceiptModal.jsx";

const SCHOOL_NAME = "Rising School";

// ✅ Isla liiska fasalada ee AddStudent.jsx/BulkRegistration.jsx isticmaalaan
const classOptions = [
  "Fasalka 1aad",
  "Fasalka 2aad",
  "Fasalka 3aad",
  "PP",
  "PI",
  "G8 A",
  "G8 B",
  "F1",
  "F2",
  "F3",
  "F4",
];

const currentMonthKey = () => new Date().toISOString().slice(0, 7); // "2026-07"

const monthLabel = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

// "2026-03" + 2 -> "2026-05"
function monthKeyAdd(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.toISOString().slice(0, 7);
}

// Bisha ardaygu ku bilaabmay (createdAt) — waa bisha ugu horeysa ee uu
// lacag ku leeyahay. Haddii createdAt maqan yahay, bisha hadda waa la
// isticmaalaa (safety fallback).
function registrationMonthKey(student) {
  const ts = student.createdAt;
  if (ts?.seconds) {
    return new Date(ts.seconds * 1000).toISOString().slice(0, 7);
  }
  return currentMonthKey();
}

// Ka soo mar bilaha, laga bilaabo `startKey`, ilaa la helo mid aan
// gabi ahaanba la bixin (ma jirin `fullyPaid` set-ka).
function findNextUnpaidMonth(fullyPaidSet, startKey, safetyCap = 120) {
  let key = startKey;
  for (let i = 0; i < safetyCap; i++) {
    if (!fullyPaidSet.has(key)) return key;
    key = monthKeyAdd(key, 1);
  }
  return key;
}

// Qaybi lacagta la geliyay (entered) bilo-bilo, laga bilaabo bisha ugu
// horeysa ee aan la bixin — marka hore dhamaystir bishii hore ee qeyb
// ahaan la bixiyay (partialMap) haddii ay jirto, kadibna sii wad bilaha
// xiga ilaa lacagtu dhammaato. Waxay soo celisaa liis update ah oo
// bil-bil ah, kala mid ah `{ monthKey, paidAmount, remaining, status }`.
function distributePayment({ entered, monthlyFee, fullyPaidSet, partialMap, startKey }) {
  const updates = [];
  let cash = entered;
  let cursor = startKey;
  let guard = 0;

  while (cash > 0 && guard < 120) {
    if (fullyPaidSet.has(cursor)) {
      cursor = monthKeyAdd(cursor, 1);
      guard += 1;
      continue;
    }

    const already = partialMap[cursor] || 0;
    const needed = monthlyFee - already;
    const apply = Math.min(cash, needed);
    const newPaid = already + apply;
    const newRemaining = Math.max(monthlyFee - newPaid, 0);
    const status = newRemaining <= 0 ? "Paid" : "Not Paid";

    updates.push({ monthKey: cursor, paidAmount: newPaid, remaining: newRemaining, status });
    cash -= apply;

    if (status === "Paid") {
      fullyPaidSet.add(cursor);
      cursor = monthKeyAdd(cursor, 1);
    } else {
      // Lacagtii way dhammaatay bishan gudaheeda — jooji halkan.
      break;
    }
    guard += 1;
  }

  return updates;
}

export default function Classes() {
  const [students, setStudents] = useState([]);
  const [paymentsByStudent, setPaymentsByStudent] = useState({}); // studentId -> record[] (sorted by monthKey)
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState(null);
  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  // ✅ Studentyada horeyba "Paid" u ah bishan — "Enter Amount" column-ka
  // waxa lagu tusayaa "Edit" button. Marka la taabto, meeshaas waxay ku
  // soo noqotaa input furan oo hore u buuxsan lacagtii ugu dambeysay ee
  // la kaydiyay bishan (partialThisMonth/fee), si lacagta loo bedeli
  // karo kadibna dib loo kaydiyo (Save ama Save All) — isla habka
  // Payments.jsx isticmaalo, halkan sidoo kale wax marnaba lama xidho.
  const [editingIds, setEditingIds] = useState({});
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [profileStudent, setProfileStudent] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentData = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (s) =>
            !s.pendingDeletion &&
            s.studentId &&
            String(s.studentId).trim() !== "" &&
            s.fullName &&
            String(s.fullName).trim() !== ""
        );
      setStudents(studentData);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const byStudent = {};
      paymentsSnap.docs.forEach((d) => {
        const data = d.data();
        const sid = data.studentId;
        if (!sid) return;
        if (!byStudent[sid]) byStudent[sid] = [];
        byStudent[sid].push(data);
      });
      Object.keys(byStudent).forEach((sid) => {
        byStudent[sid].sort((a, b) => (a.monthKey || "").localeCompare(b.monthKey || ""));
      });
      setPaymentsByStudent(byStudent);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  // ---- Class grid: fasalada 11-ka ah + fasal kasta oo dheeraad ah oo
  // xogta ku jira (si aan cid loo qariyin haddii className aanu ka mid
  // ahayn liiska caadiga ah) ----
  const classGroups = useMemo(() => {
    const groups = {};
    classOptions.forEach((c) => (groups[c] = []));
    students.forEach((s) => {
      const cls = s.className || "Unknown";
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(s);
    });
    const extras = Object.keys(groups)
      .filter((c) => !classOptions.includes(c))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [...classOptions, ...extras].map((c) => [c, groups[c]]);
  }, [students]);

  const currentClassStudents = useMemo(() => {
    if (!selectedClass) return [];
    const list = students.filter((s) => (s.className || "Unknown") === selectedClass);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.studentId || "").toLowerCase().includes(q) ||
        (s.fullName || "").toLowerCase().includes(q)
    );
  }, [students, selectedClass, search]);

  const isFreeStudent = (student) => student.feeType === "Free";

  // ---- Xaaladda "this month" ee arday gaar ah, sida Payments.jsx u
  // tusayo miiska (Paid / Remaining / Status columns) — waxaa laga
  // soo qaatay diiwaannada dhammaan bilaha ee ardaygan. ----
  function getStudentMonthState(studentId) {
    const records = paymentsByStudent[studentId] || [];
    const fullyPaidSet = new Set();
    const partialMap = {};
    records.forEach((r) => {
      if (!r.monthKey) return;
      if (r.status === "Paid") fullyPaidSet.add(r.monthKey);
      else if (r.paidAmount) partialMap[r.monthKey] = r.paidAmount;
    });
    return { records, fullyPaidSet, partialMap };
  }

  const filteredClassStats = useMemo(() => {
    const paidThisMonthCount = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      return fullyPaidSet.has(currentMonthKey());
    }).length;
    return { total: currentClassStudents.length, paidThisMonthCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClassStudents, paymentsByStudent]);

  // ✅ Fur "Edit" — ka soo buuxi input-ka lacagtii ugu dambeysay ee
  // BISHAN la kaydiyay (fee-ga oo dhan haddii "Paid" yahay), si
  // cashier-ku u arko waxa horeyba jira kadibna u bedelo.
  const startEdit = (student) => {
    const fee = Number(student.monthlyFee || 0);
    const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
    const thisMonthKey = currentMonthKey();
    const paidThisMonth = fullyPaidSet.has(thisMonthKey);
    const partialThisMonth = partialMap[thisMonthKey] || 0;
    const prefill = paidThisMonth ? fee : partialThisMonth;

    setAmounts({
      ...amounts,
      [student.id]: String(prefill || ""),
    });
    setEditingIds({ ...editingIds, [student.id]: true });
  };

  // ✅ "Edit All" — fur mar hal ku dhammaan ardayda muuqda (currentClassStudents)
  // ee horeyba "Paid" u ah bishan, midkastana lacagtiisii ugu dambeysay
  // ee bishan lagu soo buuxinayo, si dhammaantood lacagahooda loo bedeli
  // karo, kadibna hal mar "Save All" lagu kaydiyo.
  const editAll = () => {
    const thisMonthKey = currentMonthKey();
    const targets = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      return fullyPaidSet.has(thisMonthKey);
    });

    if (targets.length === 0) {
      alert("Ma jiraan arday 'Paid' ah bishan oo la edit-gareyn karo.");
      return;
    }

    const nextAmounts = { ...amounts };
    const nextEditing = { ...editingIds };

    targets.forEach((student) => {
      const fee = Number(student.monthlyFee || 0);
      nextAmounts[student.id] = String(fee || "");
      nextEditing[student.id] = true;
    });

    setAmounts(nextAmounts);
    setEditingIds(nextEditing);
  };

  // ---- Kaydi lacagta la geliyay, iyada oo bilo-bilo loo qaybinayo,
  // laga bilaabo bisha ugu horeysa ee aan la bixin ----
  async function savePayment(student) {
    if (isFreeStudent(student)) return;

    const entered = Number(amounts[student.id] || 0);
    if (entered <= 0) {
      alert("Fadlan geli lacagta la bixiyay");
      return;
    }

    const monthlyFee = Number(student.monthlyFee || 0);
    if (monthlyFee <= 0) {
      alert("Ardaygan Monthly Fee sax ah lama helin.");
      return;
    }

    const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
    const startKey = findNextUnpaidMonth(
      fullyPaidSet,
      registrationMonthKey(student)
    );

    const updates = distributePayment({
      entered,
      monthlyFee,
      fullyPaidSet: new Set(fullyPaidSet), // koobiye — yaan lama-taaban lahayn state-ka asalka ah
      partialMap: { ...partialMap },
      startKey,
    });

    if (updates.length === 0) return;

    try {
      setSavingId(student.id);

      const batch = writeBatch(db);
      updates.forEach((u) => {
        const paymentDocId = `${student.studentId}_${u.monthKey}`;
        batch.set(doc(db, "payments", paymentDocId), {
          studentId: student.studentId,
          studentName: student.fullName,
          className: student.className || "",
          schoolName: SCHOOL_NAME,
          monthlyFee,
          paidAmount: u.paidAmount,
          remaining: u.remaining,
          status: u.status,
          monthKey: u.monthKey,
          monthLabel: monthLabel(u.monthKey),
          studentPhone: student.studentPhone || "",
          parentPhone: student.parentPhone || "",
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      // ---- Cusboonaysii state-ka local-ka ah si miiska/profile-ku
      // isla markiiba u tuso xogta cusub, iyada oo aan loo baahnayn
      // in bogga dib loo soo shubo ----
      setPaymentsByStudent((prev) => {
        const next = { ...prev };
        const existing = [...(next[student.studentId] || [])];
        updates.forEach((u) => {
          const idx = existing.findIndex((r) => r.monthKey === u.monthKey);
          const record = {
            studentId: student.studentId,
            studentName: student.fullName,
            className: student.className || "",
            monthlyFee,
            paidAmount: u.paidAmount,
            remaining: u.remaining,
            status: u.status,
            monthKey: u.monthKey,
            monthLabel: monthLabel(u.monthKey),
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
          };
          if (idx >= 0) existing[idx] = record;
          else existing.push(record);
        });
        existing.sort((a, b) => (a.monthKey || "").localeCompare(b.monthKey || ""));
        next[student.studentId] = existing;
        return next;
      });

      setAmounts((prev) => ({ ...prev, [student.id]: "" }));
      setEditingIds((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });

      // ---- Rasiid — hal rasiid oo tusaya lacagta la bixiyay oo dhan.
      // Haddii bil qura la bixiyay, tus bishaas kaliya; haddii dhowr
      // bilood la bixiyay, tus tiro-jireedka "Bisha 1 – Bisha u
      // dambeysa (X Months)". ----
      const receiptMonthLabel =
        updates.length === 1
          ? monthLabel(updates[0].monthKey)
          : `${monthLabel(updates[0].monthKey)} – ${monthLabel(
              updates[updates.length - 1].monthKey
            )} (${updates.length} Months)`;

      setReceiptPayment({
        studentId: student.studentId,
        studentName: student.fullName,
        className: student.className || "",
        schoolName: SCHOOL_NAME,
        monthLabel: receiptMonthLabel,
        paidAmount: entered,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
      });
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  }

  // ✅ "Save All" — kaydi hal mar dhammaan ardayda fasalkan ee lacagta
  // loo geliyay (kuwa "Enter Amount" ku jira — kuwa madhan waa la iska
  // dhaafaa). Ardayda horeyba "Paid" ah bishan waa la iska dhaafaa,
  // MADAAMA ay kaliya la bedeli karaan marka la taabto "Edit"
  // gaarkooda (ama "Edit All") oo la furo (editingIds) — sidaas ayaan
  // lacag looga badalin arday aan la doonayn in la taabto. Wax lama
  // xidho — waa mid la isticmaali karo goor kasta.
  async function saveAll() {
    const targets = currentClassStudents.filter((s) => {
      if (isFreeStudent(s)) return false;
      const entered = Number(amounts[s.id] || 0);
      if (entered <= 0) return false;
      const { fullyPaidSet } = getStudentMonthState(s.studentId);
      const paidThisMonth = fullyPaidSet.has(currentMonthKey());
      return !paidThisMonth || editingIds[s.id];
    });

    if (targets.length === 0) {
      alert("Ma jiro arday lacag loo geliyay ee weli aan la kaydin.");
      return;
    }

    try {
      setSavingAll(true);

      const batch = writeBatch(db);
      const nextPaymentsByStudent = { ...paymentsByStudent };

      targets.forEach((student) => {
        const entered = Number(amounts[student.id] || 0);
        const monthlyFee = Number(student.monthlyFee || 0);
        if (monthlyFee <= 0) return;

        const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
        const startKey = findNextUnpaidMonth(
          fullyPaidSet,
          registrationMonthKey(student)
        );

        const updates = distributePayment({
          entered,
          monthlyFee,
          fullyPaidSet: new Set(fullyPaidSet),
          partialMap: { ...partialMap },
          startKey,
        });

        if (updates.length === 0) return;

        const existing = [...(nextPaymentsByStudent[student.studentId] || [])];
        updates.forEach((u) => {
          const paymentDocId = `${student.studentId}_${u.monthKey}`;
          batch.set(doc(db, "payments", paymentDocId), {
            studentId: student.studentId,
            studentName: student.fullName,
            className: student.className || "",
            schoolName: SCHOOL_NAME,
            monthlyFee,
            paidAmount: u.paidAmount,
            remaining: u.remaining,
            status: u.status,
            monthKey: u.monthKey,
            monthLabel: monthLabel(u.monthKey),
            studentPhone: student.studentPhone || "",
            parentPhone: student.parentPhone || "",
            createdAt: serverTimestamp(),
          });

          const idx = existing.findIndex((r) => r.monthKey === u.monthKey);
          const record = {
            studentId: student.studentId,
            studentName: student.fullName,
            className: student.className || "",
            monthlyFee,
            paidAmount: u.paidAmount,
            remaining: u.remaining,
            status: u.status,
            monthKey: u.monthKey,
            monthLabel: monthLabel(u.monthKey),
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
          };
          if (idx >= 0) existing[idx] = record;
          else existing.push(record);
        });
        existing.sort((a, b) => (a.monthKey || "").localeCompare(b.monthKey || ""));
        nextPaymentsByStudent[student.studentId] = existing;
      });

      await batch.commit();

      setPaymentsByStudent(nextPaymentsByStudent);
      setAmounts({});
      setEditingIds((prev) => {
        const next = { ...prev };
        targets.forEach((student) => delete next[student.id]);
        return next;
      });

      alert(
        `${targets.length} arday ayaa lacagtoodii (${monthLabel(
          currentMonthKey()
        )}) la kaydiyay.`
      );
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setSavingAll(false);
    }
  }

  // ---- Boggu marka fasal la furay (liiska ardayda + lacagaha) ----
  if (selectedClass) {
    return (
      <div style={{ fontFamily: theme.font.body }}>
        <button
          onClick={() => {
            setSelectedClass(null);
            setSearch("");
          }}
          style={styles.backBtn}
        >
          ← Dib ugu noqo Fasalada
        </button>

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{selectedClass}</h1>
            <p style={styles.subtitle}>
              Diiwaan geli oo la soco lacagaha bilaha ee ardayda fasalkan
            </p>
          </div>
          <div style={styles.headerStats}>
            <div style={styles.statPill}>
              <span style={styles.statNum}>{filteredClassStats.total}</span>
              <span style={styles.statLabel}>Students</span>
            </div>
            <div style={styles.statPill}>
              <span style={styles.statNum}>{filteredClassStats.paidThisMonthCount}</span>
              <span style={styles.statLabel}>Paid this month</span>
            </div>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ ...styles.searchRow, marginBottom: 0, flex: "0 0 360px" }}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              placeholder="Search Student ID / Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.search}
            />
          </div>

          <button
            type="button"
            onClick={editAll}
            disabled={savingAll}
            style={{
              ...styles.editAllBtn,
              cursor: savingAll ? "not-allowed" : "pointer",
              opacity: savingAll ? 0.7 : 1,
            }}
          >
            ✏️ Edit All
          </button>

          <button
            onClick={saveAll}
            disabled={savingAll}
            style={{
              ...styles.saveAllBtn,
              background: theme.colors.brand,
              color: "#FFFFFF",
              cursor: savingAll ? "not-allowed" : "pointer",
              opacity: savingAll ? 0.7 : 1,
            }}
          >
            {savingAll ? "Saving…" : "💾 Save All"}
          </button>
        </div>

        <div style={styles.tableCard}>
          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.spinner} />
              <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>
                Loading students...
              </p>
            </div>
          ) : currentClassStudents.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={{ fontSize: 34 }}>🗂️</span>
              <p style={{ color: theme.colors.inkMuted, marginTop: 8 }}>
                Wax arday ah kuma jiraan fasalkan.
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Student Phone</th>
                  <th style={styles.th}>Parent Phone</th>
                  <th style={styles.th}>Monthly Fee</th>
                  <th style={styles.th}>Paid</th>
                  <th style={styles.th}>Remaining</th>
                  <th style={styles.th}>Enter Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Save</th>
                </tr>
              </thead>

              <tbody>
                {currentClassStudents.map((student, i) => {
                  const free = isFreeStudent(student);
                  const fee = Number(student.monthlyFee || 0);
                  const { fullyPaidSet, partialMap } = getStudentMonthState(student.studentId);
                  const paidThisMonth = !free && fullyPaidSet.has(currentMonthKey());
                  const partialThisMonth = partialMap[currentMonthKey()] || 0;

                  // ✅ Arday "Paid" ah bishan wuu sii xidhan yahay ILAA
                  // la taabto "Edit" gaarkiisa (ama "Edit All") —
                  // markaas ayaa input-kiisa la furayaa, si lacagta
                  // loo bedeli karo kadibna dib loo kaydiyo.
                  const isEditing = !!editingIds[student.id];
                  const locked = paidThisMonth && !isEditing;

                  const entered =
                    amounts[student.id] !== undefined
                      ? Number(amounts[student.id] || 0)
                      : 0;

                  const displayPaid = free
                    ? 0
                    : locked
                    ? fee
                    : partialThisMonth || entered;
                  const displayRemaining = free
                    ? 0
                    : locked
                    ? 0
                    : Math.max(fee - (partialThisMonth || entered), 0);

                  const status = free
                    ? "Free"
                    : locked
                    ? "Paid"
                    : "Not Paid";
                  const isPaidStatus = status === "Paid";
                  const isSaving = savingId === student.id;

                  return (
                    <tr
                      key={student.id}
                      style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFCFB" }}
                    >
                      <td style={styles.td}>
                        <span style={styles.idChip}>{student.studentId}</span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        <button
                          onClick={() => setProfileStudent(student)}
                          style={styles.nameBtn}
                          title="Eeg profile-ka lacagaha"
                        >
                          {student.fullName}
                        </button>
                      </td>
                      <td style={styles.td}>{student.studentPhone || "—"}</td>
                      <td style={styles.td}>{student.parentPhone || "—"}</td>
                      <td style={{ ...styles.td, ...styles.money }}>
                        {free ? "—" : `$${fee}`}
                      </td>
                      <td style={{ ...styles.td, ...styles.money }}>
                        {free ? "—" : `$${displayPaid}`}
                      </td>
                      <td style={{ ...styles.td, ...styles.money }}>
                        {free ? "—" : `$${displayRemaining}`}
                      </td>
                      <td style={styles.td}>
                        {free ? (
                          <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                        ) : locked ? (
                          <button
                            type="button"
                            onClick={() => startEdit(student)}
                            style={styles.editBtn}
                          >
                            ✏️ Edit
                          </button>
                        ) : (
                          <input
                            type="number"
                            value={amounts[student.id] || ""}
                            onChange={(e) =>
                              setAmounts({ ...amounts, [student.id]: e.target.value })
                            }
                            style={{
                              ...styles.amountInput,
                              background: theme.colors.card,
                              color: theme.colors.ink,
                            }}
                          />
                        )}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            color: free
                              ? theme.colors.brand
                              : isPaidStatus
                              ? theme.colors.mintDark
                              : theme.colors.danger,
                            background: free
                              ? `${theme.colors.brand}14`
                              : isPaidStatus
                              ? `${theme.colors.mint}1A`
                              : `${theme.colors.danger}14`,
                          }}
                        >
                          <span
                            style={{
                              ...styles.badgeDot,
                              background: free
                                ? theme.colors.brand
                                : isPaidStatus
                                ? theme.colors.mint
                                : theme.colors.danger,
                            }}
                          />
                          {status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {free ? (
                          <span style={{ color: theme.colors.inkMuted, fontSize: 12.5 }}>—</span>
                        ) : (
                          <button
                            onClick={() => savePayment(student)}
                            disabled={locked || isSaving}
                            style={{
                              ...styles.saveBtn,
                              background: locked ? "#DDE4E2" : theme.colors.mint,
                              color: locked ? theme.colors.inkMuted : "#FFFFFF",
                              cursor: locked || isSaving ? "not-allowed" : "pointer",
                              opacity: isSaving ? 0.7 : 1,
                            }}
                          >
                            {locked ? "Paid" : isSaving ? "Saving…" : "Save"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {receiptPayment && (
          <ReceiptModal payment={receiptPayment} onClose={() => setReceiptPayment(null)} />
        )}

        {profileStudent && (
          <StudentPaymentProfileModal
            student={profileStudent}
            paymentState={getStudentMonthState(profileStudent.studentId)}
            onClose={() => setProfileStudent(null)}
          />
        )}
      </div>
    );
  }

  // ---- Boggu marka aan wax fasal ah la furin (liiska fasalada oo dhan) ----
  return (
    <div style={{ fontFamily: theme.font.body }}>
      <header style={{ ...styles.header, marginBottom: 18 }}>
        <div>
          <h1 style={styles.title}>Classes</h1>
          <p style={styles.subtitle}>Dooro fasal si aad u aragto ardayda iyo lacagahooda</p>
        </div>
      </header>

      {loading ? (
        <div style={styles.emptyState}>
          <div style={styles.spinner} />
          <p style={{ color: theme.colors.inkMuted, marginTop: 12 }}>Loading classes...</p>
        </div>
      ) : (
        <div style={styles.classGrid}>
          {classGroups.map(([className, list]) => (
            <button
              key={className}
              onClick={() => {
                setSelectedClass(className);
                setSearch("");
              }}
              style={styles.classCard}
            >
              <span style={styles.classCardIcon}>🏫</span>
              <span style={styles.classCardName}>{className}</span>
              <span style={styles.classCardCount}>
                {list.length} {list.length === 1 ? "student" : "students"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Profile-ka lacagaha ardayga — u eg sawirka la bixiyay: sawirka,
// magaca, magaca hooyada, nooca fee-ga, xogta lacagta bishan, iyo
// xisaabinta guud (immisa bilood la bixiyay, immisa ka hadhay). ----
function StudentPaymentProfileModal({ student, paymentState, onClose }) {
  const { records, fullyPaidSet, partialMap } = paymentState;
  const fee = Number(student.monthlyFee || 0);
  const startKey = registrationMonthKey(student);
  const nextUnpaid = findNextUnpaidMonth(fullyPaidSet, startKey);
  const isFree = student.feeType === "Free";

  // ---- Xogta bishan (this month) — halkan ayaa cashierku ka arkayaa
  // hadii ardaygan uu horeyba u bixiyay bishan (already paid), si
  // uusan mar labaad lacag uga qaadan. ----
  const thisMonthKey = currentMonthKey();
  const paidThisMonth = fullyPaidSet.has(thisMonthKey);
  const partialThisMonth = partialMap[thisMonthKey] || 0;
  const thisMonthPaid = paidThisMonth ? fee : partialThisMonth;
  const thisMonthRemaining = Math.max(fee - thisMonthPaid, 0);
  const thisMonthStatus = isFree ? "Free" : paidThisMonth ? "Paid" : "Not Paid";

  // ---- Xisaabinta guud: immisa bilood oo dhammaystiran ayaa la
  // bixiyay ilaa hadda, iyo wadarta lacagta la bixiyay oo dhan. ----
  const monthsPaidCount = fullyPaidSet.size;
  const totalPaidAmount = records.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);

  return (
    <div style={profileStyles.overlay} onClick={onClose}>
      <div style={profileStyles.card} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={profileStyles.closeX}>
          ✕
        </button>

        <div style={profileStyles.headerRow}>
          <div style={profileStyles.photoCol}>
            <div style={profileStyles.photoWrap}>
              {student.studentPhoto ? (
                <img src={student.studentPhoto} alt="" style={profileStyles.photo} />
              ) : (
                <span style={profileStyles.photoInitial}>
                  {(student.fullName || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={profileStyles.idBadge}>STUDENT ID</div>
            <div style={profileStyles.idValue}>{student.studentId}</div>
          </div>

          <div style={profileStyles.infoCol}>
            <ProfileRow label="Full Name" value={student.fullName || "—"} strong />
            <ProfileRow label="Mother Name" value={student.motherName || "—"} />
            <ProfileRow label="Class" value={student.className || "—"} />
            <ProfileRow label="Parent Phone" value={student.parentPhone || "—"} />
            <ProfileRow label="Student Phone" value={student.studentPhone || "—"} />
          </div>
        </div>

        {isFree ? (
          <div style={profileStyles.feeBox}>
            <p style={{ color: theme.colors.inkMuted, fontSize: 13.5, margin: 0 }}>
              Ardaygan waa <strong>Free</strong> — lacag bille ah lagama rabo.
            </p>
          </div>
        ) : (
          <>
            <div style={profileStyles.feeBox}>
              <div style={profileStyles.feeBoxTitle}>💰 Fee Information</div>
              <ProfileRow label="Type of Fee" value="Monthly Fee" />
              <ProfileRow label="Monthly Fee Amount" value={`$${fee.toFixed(2)}`} />
              <ProfileRow label="Total Paid (this month)" value={`$${thisMonthPaid.toFixed(2)}`} />
              <ProfileRow label="Remaining (this month)" value={`$${thisMonthRemaining.toFixed(2)}`} danger={thisMonthRemaining > 0} />
              <div style={profileStyles.statusRow}>
                <span style={profileStyles.rowLabel}>Status</span>
                <span
                  style={{
                    ...profileStyles.statusPill,
                    background: paidThisMonth ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                    color: paidThisMonth ? theme.colors.mintDark : theme.colors.danger,
                  }}
                >
                  {thisMonthStatus} {paidThisMonth && "✓"}
                </span>
              </div>
            </div>

            <div style={profileStyles.summaryGrid}>
              <div style={profileStyles.summaryCardGreen}>
                <div style={profileStyles.summaryTitle}>📅 Payment Summary</div>
                <div style={profileStyles.summaryBig}>Paid For</div>
                <div style={profileStyles.summaryHuge}>{monthsPaidCount} Months</div>
                <div style={profileStyles.summaryLine} />
                <div style={profileStyles.summaryTotal}>Total Paid: ${totalPaidAmount.toFixed(2)}</div>
              </div>
              <div style={profileStyles.summaryCardAmber}>
                <div style={profileStyles.summaryTitleAmber}>💵 Fee Summary</div>
                <ProfileRow label="Monthly Fee" value={`$${fee.toFixed(2)}`} compact />
                <ProfileRow label="Paid Months" value={String(monthsPaidCount)} compact />
                <ProfileRow
                  label="Next Due Month"
                  value={monthLabel(nextUnpaid)}
                  compact
                  danger
                />
              </div>
            </div>

            <div style={profileStyles.periodBox}>
              <div style={profileStyles.periodTitle}>📆 Payment Period</div>
              <div style={profileStyles.periodRow}>
                <div>
                  <div style={profileStyles.periodLabel}>Payment Start Date</div>
                  <div style={profileStyles.periodValue}>{monthLabel(startKey)}</div>
                </div>
                <div style={profileStyles.periodArrow}>TO</div>
                <div style={{ textAlign: "right" }}>
                  <div style={profileStyles.periodLabel}>Next Payment Due</div>
                  <div style={{ ...profileStyles.periodValue, color: theme.colors.danger }}>
                    {monthLabel(nextUnpaid)}
                  </div>
                </div>
              </div>
            </div>

            {paidThisMonth && (
              <div style={profileStyles.alreadyPaidNotice}>
                ✓ Ardaygan horeyba wuu u bixiyay bishan ({monthLabel(thisMonthKey)}) — waxaad ka
                bedeli kartaa "Edit" ee bogga Classes haddii loo baahdo.
              </div>
            )}

            <div style={profileStyles.monthList}>
              <div style={profileStyles.monthListTitle}>Taariikhda Bilaha</div>
              {records.length === 0 ? (
                <p style={{ color: theme.colors.inkMuted, fontSize: 13, margin: 0 }}>
                  Weli lacag lama bixin ardaygan.
                </p>
              ) : (
                records.map((r) => (
                  <div key={r.monthKey} style={profileStyles.row}>
                    <span style={profileStyles.rowMonth}>{monthLabel(r.monthKey)}</span>
                    <span style={profileStyles.rowAmount}>${Number(r.paidAmount || 0).toFixed(2)}</span>
                    <span
                      style={{
                        ...profileStyles.rowStatus,
                        color: r.status === "Paid" ? theme.colors.mintDark : theme.colors.danger,
                        background:
                          r.status === "Paid" ? `${theme.colors.mint}1A` : `${theme.colors.danger}14`,
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div style={profileStyles.footerNote}>
          Fadlan hubi in lacagta la bixiyo ka hor inta uusan bisha xigta bilaabmin.
        </div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, strong, danger, compact }) {
  return (
    <div style={compact ? profileStyles.compactRow : profileStyles.infoRow}>
      <span style={profileStyles.rowLabel}>{label}</span>
      <span
        style={{
          ...(strong ? profileStyles.rowValueStrong : profileStyles.rowValue),
          color: danger ? theme.colors.danger : strong ? theme.colors.ink : theme.colors.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const styles = {
  backBtn: {
    background: "transparent",
    border: "none",
    color: theme.colors.brand,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    padding: 0,
    marginBottom: 18,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 26,
    color: theme.colors.ink,
    margin: 0,
  },
  subtitle: { color: theme.colors.inkMuted, fontSize: 14, marginTop: 6 },
  headerStats: { display: "flex", gap: 12 },
  statPill: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 20px",
    borderRadius: theme.radius.md,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    minWidth: 96,
  },
  statNum: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 20,
    color: theme.colors.brand,
  },
  statLabel: { fontSize: 11.5, color: theme.colors.inkMuted, marginTop: 2, whiteSpace: "nowrap" },
  searchRow: { position: "relative", width: 360, marginBottom: 20 },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    opacity: 0.5,
  },
  search: {
    width: "100%",
    padding: "12px 16px 12px 38px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    fontSize: 14,
    color: theme.colors.ink,
    outline: "none",
    boxSizing: "border-box",
  },
  saveAllBtn: {
    border: "none",
    padding: "12px 22px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
  },
  editAllBtn: {
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.brand,
    padding: "12px 22px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
  },
  tableCard: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    border: `1px solid ${theme.colors.border}`,
    overflow: "auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.mint,
    animation: "spin 0.8s linear infinite",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: theme.colors.brand,
    color: "#FFFFFF",
    fontWeight: 600,
    fontSize: 12.5,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 16px",
    color: theme.colors.ink,
    borderBottom: `1px solid ${theme.colors.border}`,
    whiteSpace: "nowrap",
  },
  idChip: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 999,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.brand,
  },
  nameBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    color: theme.colors.ink,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: theme.colors.border,
    textUnderlineOffset: 3,
  },
  money: { fontVariantNumeric: "tabular-nums", fontWeight: 600 },
  amountInput: {
    width: 90,
    padding: "8px 10px",
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13.5,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12.5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: "50%" },
  saveBtn: {
    border: "none",
    padding: "9px 18px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 13,
  },
  editBtn: {
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.card,
    color: theme.colors.brand,
    padding: "8px 14px",
    borderRadius: theme.radius.sm,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  classGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  classCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    padding: "20px 18px",
    borderRadius: theme.radius.lg,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: theme.font.body,
  },
  classCardIcon: { fontSize: 24 },
  classCardName: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 16,
    color: theme.colors.ink,
    marginTop: 4,
  },
  classCardCount: { fontSize: 12.5, color: theme.colors.inkMuted },
};

const profileStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1500,
    padding: 20,
  },
  card: {
    position: "relative",
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.raised,
    width: "100%",
    maxWidth: 640,
    maxHeight: "88vh",
    overflowY: "auto",
    padding: "28px 28px 20px",
    fontFamily: theme.font.body,
  },
  closeX: {
    position: "absolute",
    top: 16,
    right: 16,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 8,
    width: 30,
    height: 30,
    cursor: "pointer",
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
  headerRow: {
    display: "flex",
    gap: 24,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  photoCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    minWidth: 130,
  },
  photoWrap: {
    width: 108,
    height: 108,
    borderRadius: "50%",
    overflow: "hidden",
    border: `3px solid ${theme.colors.mint}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.colors.surface,
  },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  photoInitial: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 38,
    color: theme.colors.brand,
  },
  idBadge: {
    marginTop: 6,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: "#FFFFFF",
    background: theme.colors.brand,
    padding: "3px 12px",
    borderRadius: 999,
  },
  idValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.ink,
  },
  infoCol: { flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 4 },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "7px 0",
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: 13,
  },
  compactRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "4px 0",
    fontSize: 12.5,
  },
  rowLabel: { color: theme.colors.inkMuted },
  rowValue: { color: theme.colors.ink, fontWeight: 600 },
  rowValueStrong: {
    color: theme.colors.ink,
    fontWeight: 800,
    fontFamily: theme.font.display,
    fontSize: 15,
  },
  feeBox: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: "16px 18px",
    marginBottom: 16,
  },
  feeBoxTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.brand,
    marginBottom: 8,
  },
  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    fontSize: 13,
  },
  statusPill: {
    fontWeight: 800,
    fontSize: 12,
    padding: "4px 14px",
    borderRadius: 999,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 16,
  },
  summaryCardGreen: {
    background: `${theme.colors.mint}12`,
    border: `1px solid ${theme.colors.mint}55`,
    borderRadius: theme.radius.md,
    padding: 16,
  },
  summaryCardAmber: {
    background: `${theme.colors.amber}14`,
    border: `1px solid ${theme.colors.amber}55`,
    borderRadius: theme.radius.md,
    padding: 16,
  },
  summaryTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 12.5,
    color: theme.colors.mintDark,
    marginBottom: 6,
  },
  summaryTitleAmber: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 12.5,
    color: "#92400E",
    marginBottom: 6,
  },
  summaryBig: { fontSize: 12.5, color: theme.colors.inkMuted },
  summaryHuge: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 24,
    color: theme.colors.mintDark,
    marginTop: 2,
  },
  summaryLine: { borderTop: `1px dashed ${theme.colors.mint}55`, margin: "10px 0" },
  summaryTotal: { fontSize: 13, fontWeight: 700, color: theme.colors.mintDark },
  periodBox: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 16,
  },
  periodTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 13,
    color: theme.colors.brand,
    marginBottom: 10,
  },
  periodRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  periodLabel: { fontSize: 11.5, color: theme.colors.inkMuted },
  periodValue: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 14,
    color: theme.colors.mintDark,
    marginTop: 2,
  },
  periodArrow: {
    fontSize: 11,
    fontWeight: 800,
    color: theme.colors.inkMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  alreadyPaidNotice: {
    background: `${theme.colors.mint}1A`,
    border: `1px solid ${theme.colors.mint}`,
    color: theme.colors.mintDark,
    borderRadius: theme.radius.sm,
    padding: "10px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 16,
  },
  monthList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 },
  monthListTitle: {
    fontFamily: theme.font.display,
    fontWeight: 800,
    fontSize: 13,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
  },
  rowMonth: { fontSize: 13, fontWeight: 600, color: theme.colors.ink },
  rowAmount: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  rowStatus: { fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 },
  footerNote: {
    textAlign: "center",
    fontSize: 11.5,
    color: theme.colors.inkMuted,
    borderTop: `1px solid ${theme.colors.border}`,
    paddingTop: 12,
  },
};