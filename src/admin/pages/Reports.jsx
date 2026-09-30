import { useEffect, useMemo, useState } from "react";
import { db, storage } from "../../firebase/firebase";
import { collection, getDocs, addDoc, query, orderBy, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  BarChart3,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  Phone,
  Smartphone,
  Layers,
  FileDown,
  History,
  X,
  ExternalLink,
} from "lucide-react";
import logo from "../assets/logo.png";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SCHOOL_NAME = "AL - ISRA PRIMARY & SECONDARY SCHOOL";

export default function Reports() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);

  const now = new Date();

  const [fromMonth, setFromMonth] = useState(now.getMonth());
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth());
  const [toYear, setToYear] = useState(now.getFullYear());

  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All"); 
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const q = query(collection(db, "reportHistory"), orderBy("generatedAt", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistoryList(list);
    } catch (err) {
      console.log(err);
      alert("Wax baa qaldamay markii history-ga la soo raraya: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const studentsSnap = await getDocs(collection(db, "students"));
      const studentsMap = {};
      studentsSnap.docs.forEach((d) => {
        studentsMap[d.id] = d.data();
      });
      setStudents(studentsMap);

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const regularList = paymentsSnap.docs.map((d) => {
        const data = d.data();
        let derivedType = "regular";
        
        const feeTypeStr = (data.feeType || data.type || "").toLowerCase();
        if (feeTypeStr.includes("registration")) derivedType = "registration";
        else if (feeTypeStr.includes("roll")) derivedType = "rollNumber";
        else if (feeTypeStr.includes("examination") || feeTypeStr.includes("exam fee")) derivedType = "examination";

        return {
          id: d.id,
          type: derivedType,
          originalType: data.type || "regular",
          ...data,
        };
      });

      const examSnap = await getDocs(collection(db, "examCardPayments"));
      const examList = examSnap.docs.map((d) => ({
        id: d.id,
        type: "examCard",
        ...d.data(),
      }));

      setPayments([...regularList, ...examList]);
    } catch (err) {
      console.log(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPaidAmount = (p) => {
    if (p.type === "examCard") return Number(p.amountPaid) || 0;
    return Number(p.paidAmount) || Number(p.amountPaid) || 0;
  };

  const getFee = (p) => {
    if (p.type === "examCard") return 0; 
    return Number(p.monthlyFee) || Number(p.fee) || 0;
  };

  const getStudentPhone = (p) => {
    const student = students[p.studentId] || {};
    return p.studentPhone || student.studentPhone || "-";
  };

  const getParentPhone = (p) => {
    const student = students[p.studentId] || {};
    return p.parentPhone || student.parentPhone || "-";
  };

  const getStatus = (p) => {
    if (p.type === "examCard") return "Full Paid";

    const paid = getPaidAmount(p);
    const fee = getFee(p);

    if (typeof p.status === "string") {
      const s = p.status.toLowerCase();
      if (s === "paid" || s === "full paid") return "Full Paid";
      if (s === "partial" || s === "partial paid") return "Partial Paid";
      if (s === "unpaid") return "Unpaid";
    }

    if (paid <= 0) return "Unpaid";
    if (fee > 0 && paid >= fee) return "Full Paid";
    return "Partial Paid";
  };

  const getMonthYear = (p) => {
    if (p.monthKey && /^\d{4}-\d{2}$/.test(p.monthKey)) {
      const [y, m] = p.monthKey.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const raw = p.createdAt;
    if (!raw) return null;
    const date = raw.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(date.getTime())) return null;
    return { year: date.getFullYear(), month: date.getMonth() };
  };

  const toIndex = (year, month) => year * 12 + month;

  const filteredPayments = useMemo(() => {
    const fromIdx = toIndex(fromYear, fromMonth);
    const toIdx = toIndex(toYear, toMonth);
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);

    return payments.filter((p) => {
      const my = getMonthYear(p);
      if (!my) return false;

      const idx = toIndex(my.year, my.month);
      const rangeMatch = idx >= lo && idx <= hi;

      const status = getStatus(p);
      const statusMatch = statusFilter === "All" || status === statusFilter;

      // "regular" = Cashier transactions ONLY.
      // Registration, Roll Number, Examination and Exam Card are separate categories.
      const typeMatch =
        typeFilter === "All" ||
        p.type === typeFilter;

      const studentPhone = getStudentPhone(p);
      const parentPhone = getParentPhone(p);

      const searchMatch =
        !search.trim() ||
        (p.studentName || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.studentId || "").toLowerCase().includes(search.toLowerCase()) ||
        parentPhone.includes(search) ||
        studentPhone.includes(search);

      return rangeMatch && statusMatch && typeMatch && searchMatch;
    });
  }, [payments, students, fromMonth, fromYear, toMonth, toYear, statusFilter, typeFilter, search]);

  const totals = useMemo(() => {
    let totalIncome = 0;
    let regularIncome = 0;
    let registrationIncome = 0;
    let rollNumberIncome = 0;
    let examinationIncome = 0;
    let examCardIncome = 0;
    let fullPaid = 0;
    let partialPaid = 0;
    let unpaid = 0;

    filteredPayments.forEach((p) => {
      const paid = getPaidAmount(p);
      totalIncome += paid;

      if (p.type === "examCard") examCardIncome += paid;
      else if (p.type === "registration") registrationIncome += paid;
      else if (p.type === "rollNumber") rollNumberIncome += paid;
      else if (p.type === "examination") examinationIncome += paid;
      else regularIncome += paid;

      const status = getStatus(p);
      if (status === "Full Paid") fullPaid++;
      else if (status === "Partial Paid") partialPaid++;
      else if (status === "Unpaid") unpaid++;
    });

    return {
      totalIncome,
      regularIncome,
      registrationIncome,
      rollNumberIncome,
      examinationIncome,
      examCardIncome,
      cashierTotal: regularIncome,
      fullPaid,
      partialPaid,
      unpaid,
      total: filteredPayments.length,
    };
  }, [filteredPayments]);

  const years = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);

  const rangeLabel = useMemo(() => {
    const fromIdx = toIndex(fromYear, fromMonth);
    const toIdx = toIndex(toYear, toMonth);
    if (fromIdx === toIdx) {
      return `${monthNames[fromMonth]} ${fromYear}`;
    }
    const lo = fromIdx <= toIdx ? { m: fromMonth, y: fromYear } : { m: toMonth, y: toYear };
    const hi = fromIdx <= toIdx ? { m: toMonth, y: toYear } : { m: fromMonth, y: fromYear };
    return `${monthNames[lo.m]} ${lo.y} — ${monthNames[hi.m]} ${hi.y}`;
  }, [fromMonth, fromYear, toMonth, toYear]);

  const loadImageAsDataUrl = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = src;
    });

  const loadJsPdfLibs = () =>
    new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve();
        return;
      }
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s1.onload = () => {
        const s2 = document.createElement("script");
        s2.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
        s2.onload = () => resolve();
        s2.onerror = reject;
        document.body.appendChild(s2);
      };
      s1.onerror = reject;
      document.body.appendChild(s1);
    });

  const getTypeLabel = (p) => {
    if (p.type === "examCard") return "Exam Card";
    if (p.type === "registration") return "Registration Fee";
    if (p.type === "rollNumber") return "Roll Number Fee";
    if (p.type === "examination") return "Examination Fee";
    return "Cashier";
  };

  const handleExportPdf = async () => {
    if (filteredPayments.length === 0) {
      alert("Ma jiraan xog la exportgareyn karo bilaha aad doorattay.");
      return;
    }
    try {
      setExporting(true);
      await loadJsPdfLibs();

      let logoDataUrl = null;
      try {
        logoDataUrl = await loadImageAsDataUrl(logo);
      } catch (e) {
        console.log("Logo load failed, continuing without it", e);
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      let cursorY = 40;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 30, 20, 50, 50);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(SCHOOL_NAME, logoDataUrl ? 90 : 30, 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Transaction Report", logoDataUrl ? 90 : 30, 52);
      doc.text(`Range: ${rangeLabel}`, logoDataUrl ? 90 : 30, 67);

      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        pageWidth - 30,
        35,
        { align: "right" }
      );
      doc.setTextColor(0);

      cursorY = 85;

      const rows = filteredPayments.map((p) => {
        const status = getStatus(p);
        const isExamCard = p.type === "examCard";
        const paid = getPaidAmount(p);
        const fee = getFee(p);
        const remaining = isExamCard ? 0 : Number(p.remaining) || Math.max(fee - paid, 0);
        const my = getMonthYear(p);
        const monthLabel = my ? `${monthNames[my.month]} ${my.year}` : "-";

        return [
          p.studentName || "-",
          p.studentId || "-",
          p.className || "-",
          getTypeLabel(p),
          monthLabel,
          getStudentPhone(p),
          getParentPhone(p),
          isExamCard ? "-" : `$${fee}`,
          `$${paid}`,
          isExamCard ? "-" : `$${remaining}`,
          status,
        ];
      });

      doc.autoTable({
        startY: cursorY,
        head: [
          [
            "Magaca",
            "ID",
            "Fasalka",
            "Nooca",
            "Bisha",
            "Numb. Ardayga",
            "Numb. Waalidka",
            "Fee",
            "La Bixiyey",
            "Hadhey",
            "Status",
          ],
        ],
        body: rows,
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [109, 93, 240], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 248, 255] },
        margin: { left: 20, right: 20, bottom: 60 },
        didDrawPage: (data) => {
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageCount = doc.internal.getNumberOfPages();

          if (data.pageNumber === pageCount) {
            const finalY = data.cursor.y + 15;
            if (finalY < pageHeight - 65) {
              doc.setDrawColor(220, 220, 230);
              doc.setFillColor(255, 255, 255);
              doc.roundedRect(20, finalY, pageWidth - 40, 36, 8, 8, "FD");

              doc.setFontSize(8.5);
              doc.setFont("helvetica", "bold");
              
              // Keep the PDF footer summary clean: only the two financial totals.
              // Registration, Roll Number, Examination, Exam Card, Partial and Unpaid
              // are intentionally NOT shown in the bottom summary.
              const summaryText =
                `Total Income: $${totals.totalIncome.toLocaleString()}   |   ` +
                `Cashier: $${totals.regularIncome.toLocaleString()}`;
              doc.text(summaryText, 30, finalY + 22);
            }
          }

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(120);
          doc.text(SCHOOL_NAME, 20, pageHeight - 15);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth - 20,
            pageHeight - 15,
            { align: "right" }
          );
        },
      });

      const fileSafeRange = rangeLabel.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
      const fileName = `RisingStar_Transaction_Report_${fileSafeRange}.pdf`;

      try {
        const pdfBlob = doc.output("blob");
        const historyFileRef = ref(storage, `reportHistory/${Date.now()}_${fileName}`);
        await uploadBytes(historyFileRef, pdfBlob);
        const pdfUrl = await getDownloadURL(historyFileRef);

        await addDoc(collection(db, "reportHistory"), {
          fileName,
          fileUrl: pdfUrl,
          storagePath: historyFileRef.fullPath,
          rangeLabel,
          totalIncome: totals.totalIncome,
          regularIncome: totals.regularIncome,
          registrationIncome: totals.registrationIncome,
          rollNumberIncome: totals.rollNumberIncome,
          examinationIncome: totals.examinationIncome,
          examCardIncome: totals.examCardIncome,
          fullPaid: totals.fullPaid,
          partialPaid: totals.partialPaid,
          unpaid: totals.unpaid,
          transactionCount: filteredPayments.length,
          statusFilter,
          typeFilter,
          generatedAt: Timestamp.now(),
        });
      } catch (historyErr) {
        console.log("Failed to save report to history:", historyErr);
      }

      doc.save(fileName);
    } catch (err) {
      console.log(err);
      alert("Wax baa qaldamay markii PDF-ka la sameynayay: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="reports-page">
      <style>{`
        .reports-page {
          min-height: 100vh;
          background: #f3efe3;
          color: #172033;
          padding: 24px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .report-shell {
          width: min(1500px, 100%);
          margin: 0 auto;
          background: #fffdf7;
          border: 1px solid #c8b77e;
          border-radius: 24px;
          box-shadow: 0 16px 45px rgba(42, 48, 64, .12);
          overflow: hidden;
        }

        .report-header {
          position: relative;
          padding: 22px 28px 18px;
          display: grid;
          grid-template-columns: minmax(300px, 1fr) auto;
          align-items: center;
          gap: 22px;
          background: linear-gradient(180deg, #fffdf7 0%, #f6f0df 100%);
          border-bottom: 1px solid #d5c58f;
        }

        .report-header:after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          background: linear-gradient(90deg, #142d50, #c9ae61, #142d50);
        }

        .school-brand {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .school-logo {
          width: 66px;
          height: 66px;
          object-fit: contain;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #c9b776;
          box-shadow: 0 4px 12px rgba(20,45,80,.14);
          padding: 3px;
        }

        .school-name {
          margin: 0;
          color: #9b8350;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(20px, 2.1vw, 29px);
          letter-spacing: .5px;
          line-height: 1.1;
        }

        .report-title {
          margin: 6px 0 0;
          font-size: 20px;
          color: #101923;
          font-weight: 800;
        }

        .report-range {
          margin-top: 3px;
          color: #414957;
          font-size: 13px;
        }

        .report-actions {
          display: flex;
          gap: 9px;
          align-items: center;
        }

        .report-action {
          border: 1px solid #b9a666;
          background: #142d50;
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(20,45,80,.12);
        }

        .report-action.secondary {
          background: #fffdf7;
          color: #142d50;
        }

        .report-action:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .report-body {
          padding: 18px 24px 28px;
        }

        .filters {
          display: grid;
          grid-template-columns: 1.05fr 1.05fr 1.15fr 1.25fr minmax(220px, 2fr);
          gap: 10px;
          margin-bottom: 15px;
        }

        .filter-box {
          min-width: 0;
          border: 1px solid #d0c49d;
          background: #fffef9;
          border-radius: 10px;
          padding: 7px 10px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        }

        .filter-label {
          display: block;
          color: #5d6572;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .35px;
          margin-bottom: 3px;
        }

        .filter-content {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .filter-content svg {
          flex: 0 0 auto;
          color: #284a70;
        }

        .filter-select {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1d2938;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 0;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d0c49d;
          background: #fffef9;
          border-radius: 10px;
          padding: 0 11px;
        }

        .search-box svg { color: #69717c; flex: 0 0 auto; }

        .search-input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1d2938;
          font-size: 12px;
          padding: 13px 0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .metric-card {
          position: relative;
          overflow: hidden;
          border: 1px solid #cfc39e;
          border-radius: 13px;
          background: linear-gradient(135deg, #fffef9, #f4efdf);
          padding: 13px 15px;
          min-height: 74px;
        }

        .metric-card:before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--metric-color);
        }

        .metric-label {
          color: #646b76;
          font-size: 10.5px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .metric-value {
          color: #172033;
          font-size: 21px;
          font-weight: 900;
          letter-spacing: -.4px;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid #c6b98f;
          border-radius: 12px;
          background: #fffef9;
          box-shadow: 0 6px 18px rgba(31,43,60,.06);
        }

        .report-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 1050px;
        }

        .report-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #183657;
          color: #fff;
          border-right: 1px solid rgba(255,255,255,.18);
          padding: 8px 8px;
          font-size: 10.5px;
          font-weight: 800;
          text-align: left;
          white-space: nowrap;
        }

        .report-table tbody td {
          border-right: 1px solid #d8ceb0;
          border-bottom: 1px solid #ddd4bc;
          padding: 7px 8px;
          color: #1f2937;
          font-size: 11px;
          white-space: nowrap;
          background: #fffdf7;
        }

        .report-table tbody tr:nth-child(even) td { background: #f7f2e5; }
        .report-table tbody tr:hover td { background: #eee6cf; }

        .student-photo {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid #c8b77e;
          vertical-align: middle;
        }

        .name-cell { font-weight: 750; color: #152235 !important; }
        .money { font-weight: 800; }
        .muted-cell { color: #69717c !important; }

        .type-badge, .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 9.5px;
          font-weight: 800;
          white-space: nowrap;
        }

        .empty-state {
          text-align: center;
          padding: 55px 20px;
          color: #6d7480;
          font-size: 13px;
        }

        .report-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 4px 0;
          color: #6c727b;
          font-size: 10px;
        }

        @media (max-width: 1150px) {
          .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .search-box { min-height: 42px; }
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 720px) {
          .reports-page { padding: 10px; }
          .report-header { grid-template-columns: 1fr; padding: 16px; }
          .report-actions { justify-content: flex-start; }
          .report-body { padding: 12px; }
          .filters, .summary-grid { grid-template-columns: 1fr; }
          .school-name { font-size: 20px; }
        }
      `}</style>

      <div className="report-shell">
        <header className="report-header">
          <div className="school-brand">
            <img className="school-logo" src={logo} alt="School Logo" />
            <div>
              <h1 className="school-name">{SCHOOL_NAME}</h1>
              <div className="report-title">Transaction Report</div>
              <div className="report-range">Range: {rangeLabel}</div>
            </div>
          </div>

          <div className="report-actions">
            <button className="report-action secondary" onClick={handleOpenHistory}>
              <History size={15} />
              History
            </button>
            <button className="report-action" onClick={handleExportPdf} disabled={exporting}>
              <FileDown size={15} />
              {exporting ? "Diyaarinaya..." : "Export PDF"}
            </button>
          </div>
        </header>

        <main className="report-body">
          <div className="filters">
            <div className="filter-box">
              <span className="filter-label">Laga bilaabo</span>
              <div className="filter-content">
                <Calendar size={14} />
                <select className="filter-select" value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}>
                  {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="filter-select" value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="filter-box">
              <span className="filter-label">Ilaa</span>
              <div className="filter-content">
                <Calendar size={14} />
                <select className="filter-select" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}>
                  {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="filter-select" value={toYear} onChange={(e) => setToYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="filter-box">
              <span className="filter-label">Status</span>
              <div className="filter-content">
                <Wallet size={14} />
                <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="All">Dhammaan Status</option>
                  <option value="Full Paid">Full Paid</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            <div className="filter-box">
              <span className="filter-label">Nooca Lacagta</span>
              <div className="filter-content">
                <Layers size={14} />
                <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="All">Dhammaan Nooca Lacagta</option>
                  <option value="regular">Lacagta Cashierka Kaliya</option>
                  <option value="registration">Registration Fees</option>
                  <option value="rollNumber">Roll Number Fees</option>
                  <option value="examination">Examination Fees</option>
                  <option value="examCard">Lacagta Kaarka Imtixaanka</option>
                </select>
              </div>
            </div>

            <div className="search-box">
              <Search size={16} />
              <input
                className="search-input"
                placeholder="Raadi magaca, ID-ga, ama numbarka waalidka..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="summary-grid">
            <MetricCard label="Wadarta Lacagta Soo Gashay" value={`$${totals.totalIncome.toLocaleString()}`} color="#183657" />
            <MetricCard label="Lacagta Cashierka" value={`$${totals.cashierTotal.toLocaleString()}`} color="#b89b52" />
            <MetricCard label="Full Paid" value={totals.fullPaid} color="#2f8f55" />
            <MetricCard label="Partial / Unpaid" value={`${totals.partialPaid} / ${totals.unpaid}`} color="#c98727" />
          </div>

          {loading ? (
            <div className="empty-state">Soo raraya xogta...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="empty-state">Ma jiraan xog waafaqsan filters-ka aad doorattay.</div>
          ) : (
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <Th>Sawir</Th>
                    <Th>Magaca</Th>
                    <Th>ID</Th>
                    <Th>Fasalka</Th>
                    <Th>Nooca</Th>
                    <Th>Bisha</Th>
                    <Th>Numb. Ardayga</Th>
                    <Th>Numb. Waalidka</Th>
                    <Th>Fee</Th>
                    <Th>La Bixiyay</Th>
                    <Th>Hadhay</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const status = getStatus(p);
                    const student = students[p.studentId] || {};
                    const isExamCard = p.type === "examCard";
                    const paid = getPaidAmount(p);
                    const fee = getFee(p);
                    const remaining = isExamCard ? 0 : Number(p.remaining) || Math.max(fee - paid, 0);
                    const my = getMonthYear(p);
                    const monthLabel = my ? `${monthNames[my.month]} ${my.year}` : "-";

                    return (
                      <tr key={`${p.type}-${p.id}`}>
                        <Td>
                          <img
                            className="student-photo"
                            src={student.studentPhoto || "https://ui-avatars.com/api/?background=183657&color=fff&name=" + encodeURIComponent(p.studentName || "S")}
                            alt=""
                          />
                        </Td>
                        <Td style={{ fontWeight: 750 }}>{p.studentName || "-"}</Td>
                        <Td>{p.studentId || "-"}</Td>
                        <Td>{p.className || "-"}</Td>
                        <Td><TypeBadge type={p.type} examType={p.examType} /></Td>
                        <Td>{monthLabel}</Td>
                        <Td className="muted-cell">{getStudentPhone(p)}</Td>
                        <Td className="muted-cell">{getParentPhone(p)}</Td>
                        <Td className="money">{isExamCard ? "-" : `$${fee}`}</Td>
                        <Td className="money">${paid}</Td>
                        <Td className="money">{isExamCard ? "-" : `$${remaining}`}</Td>
                        <Td><StatusBadge status={status} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="report-footer">
            <span>{SCHOOL_NAME}</span>
            <span>{filteredPayments.length} transaction{filteredPayments.length === 1 ? "" : "s"} · {rangeLabel}</span>
          </div>
        </main>
      </div>

      {showHistory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 18,
          }}
          onClick={() => setShowHistory(false)}
        >
          <div
            style={{
              background: "#fffdf7",
              border: "1px solid #c8b77e",
              borderRadius: 18,
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 70px rgba(0,0,0,.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "17px 20px",
              borderBottom: "1px solid #ddd3b8",
              background: "#f5efdf",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}>
              <h2 style={{ color: "#183657", margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
                <History size={19} />
                Report History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  background: "#183657",
                  border: 0,
                  color: "#fff",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              {loadingHistory ? (
                <p style={{ color: "#69717c" }}>Loading...</p>
              ) : historyList.length === 0 ? (
                <p style={{ color: "#69717c" }}>Weli ma jiraan report-yo la export-gareeyay.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {historyList.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 14,
                        background: "#f8f3e7",
                        border: "1px solid #d6c9a4",
                        borderRadius: 12,
                        padding: "13px 15px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ color: "#183657", fontWeight: 800, fontSize: 14 }}>{h.rangeLabel || "-"}</div>
                        <div style={{ color: "#69717c", fontSize: 11.5, marginTop: 3 }}>
                          {h.transactionCount ?? 0} transaction{(h.transactionCount ?? 0) === 1 ? "" : "s"} · Total: ${(h.totalIncome ?? 0).toLocaleString()}
                        </div>
                        <div style={{ color: "#8a9099", fontSize: 10.5, marginTop: 2 }}>
                          {h.generatedAt?.toDate ? h.generatedAt.toDate().toLocaleString() : "-"}
                        </div>
                      </div>

                      {h.fileUrl && (
                        <a
                          href={h.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#183657",
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: 11.5,
                            padding: "9px 13px",
                            borderRadius: 8,
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={13} />
                          Fur PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBox({ icon: Icon, children, label }) {
  return (
    <div className="filter-box">
      {label && <span className="filter-label">{label}</span>}
      <div className="filter-content">
        <Icon size={14} />
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="metric-card" style={{ "--metric-color": color }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Full Paid": { bg: "#dff1e3", color: "#2f7d46", icon: "✓" },
    "Partial Paid": { bg: "#f8eacb", color: "#a36a16", icon: "!" },
    Unpaid: { bg: "#f6dddd", color: "#b04444", icon: "×" },
  };
  const s = map[status] || map.Unpaid;

  return (
    <span className="status-badge" style={{ background: s.bg, color: s.color }}>
      <span>{s.icon}</span>
      {status}
    </span>
  );
}

function TypeBadge({ type, examType }) {
  let bg = "#e4edf6";
  let color = "#315c82";
  let label = "Cashier";

  if (type === "examCard") {
    bg = "#eee5f7";
    color = "#764b9b";
    label = `Exam Card${examType ? " (" + examType + ")" : ""}`;
  } else if (type === "registration") {
    bg = "#f8e2ed";
    color = "#a83f70";
    label = "Registration";
  } else if (type === "rollNumber") {
    bg = "#e1f2eb";
    color = "#26765b";
    label = "Roll Number";
  } else if (type === "examination") {
    bg = "#f8ebd3";
    color = "#9a6a1d";
    label = "Examination";
  }

  return (
    <span className="type-badge" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

function Th({ children }) {
  return <th>{children}</th>;
}

function Td({ children, style, className = "" }) {
  return <td className={className} style={style}>{children}</td>;
}

const selectStyle = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#1d2938",
  fontSize: 12,
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  border: "0",
  outline: "none",
  color: "#1d2938",
  fontSize: 12,
  background: "transparent",
};
