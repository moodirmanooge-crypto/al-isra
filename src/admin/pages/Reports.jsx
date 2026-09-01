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
  CreditCard,
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

      const typeMatch = 
        typeFilter === "All" || 
        p.type === typeFilter || 
        (typeFilter === "regular" && (p.type === "regular" || p.type === "registration" || p.type === "rollNumber" || p.type === "examination"));

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
      cashierTotal: regularIncome + registrationIncome + rollNumberIncome + examinationIncome,
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
              
              // Totals oo la raaciyay Registration, Roll number, iyo Examination Fees
              const summaryText = `Total Income: $${totals.totalIncome}   |   Cashier: $${totals.regularIncome}   |   Registration: $${totals.registrationIncome}   |   Roll Number: $${totals.rollNumberIncome}   |   Examination: $${totals.examinationIncome}   |   Exam Card: $${totals.examCardIncome}   |   Full Paid: ${totals.fullPaid}   |   Partial: ${totals.partialPaid}   |   Unpaid: ${totals.unpaid}`;
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
    <div style={{ background: "#0b0a1c", minHeight: "100vh", padding: "30px" }}>
      <div
        style={{
          background: "linear-gradient(160deg,#151233,#181341)",
          borderRadius: 24,
          padding: "36px 40px",
          border: "1px solid rgba(139,108,245,0.25)",
          maxWidth: 1400,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <style>{`
          select option {
            background: #1e1a4a;
            color: #ffffff;
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 30,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 55,
                height: 55,
                borderRadius: 15,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart3 color="#fff" size={26} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, color: "#fff" }}>Reports</h1>
              <div style={{ color: "#8b87ad", fontSize: 14 }}>
                Warbixinta Lacagaha, Cashierka iyo Bixinta Ardayda
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleOpenHistory}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.04)",
                color: "#e5e3f7",
                border: "1.5px solid rgba(139,108,245,0.35)",
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <History size={18} />
              History
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exporting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg,#6d5df0,#8b6cf5)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: exporting ? "not-allowed" : "pointer",
                opacity: exporting ? 0.7 : 1,
              }}
            >
              <FileDown size={18} />
              {exporting ? "Diyaarinaya PDF..." : "Export PDF"}
            </button>
          </div>
        </div>

        {/* Range label */}
        <div
          style={{
            color: "#a9a4d6",
            fontSize: 13,
            marginBottom: 14,
            fontWeight: 600,
          }}
        >
          Muujinaya: {rangeLabel}
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 30,
            alignItems: "center",
            position: "relative",
            zIndex: 20,
          }}
        >
          <FilterBox icon={Calendar} label="Laga bilaabo">
            <select
              style={selectStyle}
              value={fromMonth}
              onChange={(e) => setFromMonth(Number(e.target.value))}
            >
              {monthNames.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={fromYear}
              onChange={(e) => setFromYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterBox>

          <FilterBox icon={Calendar} label="Ilaa">
            <select
              style={selectStyle}
              value={toMonth}
              onChange={(e) => setToMonth(Number(e.target.value))}
            >
              {monthNames.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              style={selectStyle}
              value={toYear}
              onChange={(e) => setToYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterBox>

          <FilterBox icon={Wallet}>
            <select
              style={selectStyle}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Dhammaan Status</option>
              <option value="Full Paid">Full Paid</option>
              <option value="Partial Paid">Partial Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </FilterBox>

          <FilterBox icon={Layers}>
            <select
              style={selectStyle}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="All">Dhammaan Nooca Lacagta</option>
              <option value="regular">Lacagta Cashierka (Caadiga ah)</option>
              <option value="registration">Registration Fees</option>
              <option value="rollNumber">Roll Number Fees</option>
              <option value="examination">Examination Fees</option>
              <option value="examCard">Lacagta Kaarka Imtixaanka</option>
            </select>
          </FilterBox>

          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={17}
              color="#8b87ad"
              style={{ position: "absolute", left: 14, top: 13 }}
            />
            <input
              style={{ ...inputStyle, paddingLeft: 40 }}
              placeholder="Raadi magaca, ID-ga, ama numbarka waalidka..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <SummaryCard
            icon={Wallet}
            label="Wadarta Lacagta Soo Gashay (Dhammaan)"
            value={`$${totals.totalIncome.toLocaleString()}`}
            color="#6d5df0"
          />
          <SummaryCard
            icon={Wallet}
            label="Lacagta Cashierka (Caadiga ah)"
            value={`$${totals.cashierTotal.toLocaleString()}`}
            color="#38BDF8"
          />
          <SummaryCard
            icon={CreditCard}
            label="Lacagta Kaarka Imtixaanka"
            value={`$${totals.examCardIncome.toLocaleString()}`}
            color="#A855F7"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            marginBottom: 34,
          }}
        >
          <SummaryCard
            icon={CheckCircle2}
            label="Full Paid"
            value={totals.fullPaid}
            color="#22C55E"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Partial Paid"
            value={totals.partialPaid}
            color="#F59E0B"
          />
          <SummaryCard
            icon={Clock}
            label="Unpaid / Reminder"
            value={totals.unpaid}
            color="#EF4444"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
            Soo raraya xogta...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ color: "#8b87ad", textAlign: "center", padding: 60 }}>
            Ma jiraan xog waafaqsan bilaha aad doorattay.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                    <tr key={`${p.type}-${p.id}`} style={{ borderBottom: "1px solid rgba(139,108,245,0.12)" }}>
                      <Td>
                        <img
                          src={
                            student.studentPhoto ||
                            "https://ui-avatars.com/api/?background=6d5df0&color=fff&name=" +
                              encodeURIComponent(p.studentName || "S")
                          }
                          alt=""
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid rgba(139,108,245,0.4)",
                          }}
                        />
                      </Td>
                      <Td style={{ fontWeight: 600, color: "#fff" }}>{p.studentName}</Td>
                      <Td>{p.studentId}</Td>
                      <Td>{p.className || "-"}</Td>
                      <Td>
                        <TypeBadge type={p.type} examType={p.examType} />
                      </Td>
                      <Td>{monthLabel}</Td>
                      <Td>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Smartphone size={14} color="#8b87ad" />
                          {getStudentPhone(p)}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Phone size={14} color="#8b87ad" />
                          {getParentPhone(p)}
                        </span>
                      </Td>
                      <Td>{isExamCard ? "-" : `$${fee}`}</Td>
                      <Td>${paid}</Td>
                      <Td>{isExamCard ? "-" : `$${remaining}`}</Td>
                      <Td>
                        <StatusBadge status={status} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History modal */}
      {showHistory && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#151233,#181341)",
              border: "1px solid rgba(139,108,245,0.3)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid rgba(139,108,245,0.2)",
                position: "sticky",
                top: 0,
                background: "#181341",
              }}
            >
              <h2
                style={{
                  color: "#fff",
                  margin: 0,
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <History size={20} color="#8b6cf5" />
                Report History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "none",
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
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "18px 24px 24px" }}>
              {loadingHistory ? (
                <p style={{ color: "#8b87ad" }}>Loading...</p>
              ) : historyList.length === 0 ? (
                <p style={{ color: "#8b87ad" }}>
                  Weli ma jiraan report-yo la export-gareeyay.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {historyList.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 14,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(139,108,245,0.2)",
                        borderRadius: 14,
                        padding: "14px 18px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                          {h.rangeLabel || "-"}
                        </div>
                        <div style={{ color: "#8b87ad", fontSize: 12, marginTop: 3 }}>
                          {h.transactionCount ?? 0} transaction
                          {(h.transactionCount ?? 0) === 1 ? "" : "s"} · Total: $
                          {(h.totalIncome ?? 0).toLocaleString()}
                        </div>
                        <div style={{ color: "#6f6a92", fontSize: 11.5, marginTop: 2 }}>
                          {h.generatedAt?.toDate
                            ? h.generatedAt.toDate().toLocaleString()
                            : "-"}
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
                            border: "1px solid rgba(139,108,245,0.35)",
                            background: "rgba(139,108,245,0.12)",
                            color: "#c4b5fd",
                            fontWeight: 700,
                            fontSize: 12.5,
                            padding: "9px 14px",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span style={{ fontSize: 11, color: "#8b87ad", fontWeight: 600, paddingLeft: 4 }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1.5px solid rgba(139,108,245,0.35)",
          borderRadius: 12,
          padding: "6px 14px",
        }}
      >
        <Icon size={16} color="#8b6cf5" />
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(139,108,245,0.25)",
        borderRadius: 18,
        padding: "22px 24px",
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
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#8b87ad" }}>{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Full Paid": { bg: "#22C55E22", color: "#22C55E" },
    "Partial Paid": { bg: "#F59E0B22", color: "#F59E0B" },
    Unpaid: { bg: "#EF444422", color: "#EF4444" },
  };
  const s = map[status] || map["Unpaid"];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: "6px 12px",
        borderRadius: 20,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function TypeBadge({ type, examType }) {
  let bg = "#38BDF822";
  let color = "#38BDF8";
  let label = "Cashier";

  if (type === "examCard") {
    bg = "#A855F722";
    color = "#A855F7";
    label = `Exam Card${examType ? " (" + examType + ")" : ""}`;
  } else if (type === "registration") {
    bg = "#EC489922";
    color = "#EC4899";
    label = "Registration";
  } else if (type === "rollNumber") {
    bg = "#10B98122";
    color = "#10B981";
    label = "Roll Number";
  } else if (type === "examination") {
    bg = "#F59E0B22";
    color = "#F59E0B";
    label = "Examination";
  }

  return (
    <span
      style={{
        background: bg,
        color,
        padding: "6px 12px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 14px",
        color: "#8b87ad",
        fontSize: 13,
        fontWeight: 600,
        borderBottom: "1.5px solid rgba(139,108,245,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }) {
  return (
    <td
      style={{
        padding: "14px",
        color: "#e5e3f7",
        fontSize: 14,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

const selectStyle = {
  background: "#151233",
  border: "none",
  outline: "none",
  color: "#e5e3f7",
  fontSize: 14,
  padding: "8px 4px",
  cursor: "pointer",
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