import { useEffect, useRef, useState } from "react";
import {
  doc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import receiptBgTemplate from "../assets/receipt.png";

const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

// ---- Amount -> Words (English) ----
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function threeDigitsToWords(n) {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + " ";
    n %= 10;
  }
  if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

function integerToWords(num) {
  if (num === 0) return "Zero";
  const parts = [];
  const million = Math.floor(num / 1000000);
  const thousand = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  if (million) parts.push(`${threeDigitsToWords(million)} Million`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return parts.join(" ").trim();
}

function amountToWords(amount) {
  const num = Number(amount) || 0;
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);

  let words = `${integerToWords(dollars)} Dollar${dollars === 1 ? "" : "s"}`;
  if (cents > 0) {
    words += ` and ${integerToWords(cents)} Cent${cents === 1 ? "" : "s"}`;
  }
  return words;
}

const getNextReceiptNumber = async () => {
  const counterRef = doc(db, "counters", "receiptCounter");

  // Safety net: find the highest receiptNo actually saved so far, in case
  // the counter document ever falls behind (stuck value, blocked write,
  // manual edit, etc). This guarantees we never hand out a number that
  // has already been used.
  let highestStored = 0;
  try {
    const maxSnap = await getDocs(
      query(collection(db, "receipts"), orderBy("receiptNo", "desc"), limit(1))
    );
    if (!maxSnap.empty) {
      highestStored = Number(maxSnap.docs[0].data().receiptNo) || 0;
    }
  } catch (err) {
    console.log(err);
  }

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const counterValue = counterDoc.exists() ? Number(counterDoc.data().value || 0) : 0;
    const current = Math.max(counterValue, highestStored);
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });

  return String(nextNumber).padStart(3, "0");
};

const saveReceiptRecord = async (receiptNo, payment, paidDate) => {
  try {
    const receiptRef = doc(collection(db, "receipts"), receiptNo);
    await setDoc(receiptRef, {
      receiptNo,
      studentId: payment.studentId || null,
      studentName: payment.studentName || "",
      className: payment.className || "",
      studentPhone: payment.studentPhone || payment.parentPhone || "",
      monthLabel: payment.monthLabel || "",
      paidAmount: payment.paidAmount ?? 0,
      paymentMethod: payment.paymentMethod || "",
      evcNumber: payment.evcNumber || "",
      academicYear: academicYearLabel(paidDate),
      paidAt: paidDate,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Khalad ayaa dhacay markii rasiidka la kaydinayay:", err);
  }
};

export default function ReceiptModal({ payment, onClose }) {
  const [receiptNo, setReceiptNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const node = document.querySelector(".receipt-bg-wrapper");
      if (!node) return;

      const canvas = await html2canvas(node, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");

      // A5 landscape in mm: 210 x 148
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a5",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgRatio = canvas.width / canvas.height;
      let renderWidth = pageWidth;
      let renderHeight = renderWidth / imgRatio;

      if (renderHeight > pageHeight) {
        renderHeight = pageHeight;
        renderWidth = renderHeight * imgRatio;
      }

      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      pdf.save(`Receipt-${receiptNo || "voucher"}.pdf`);
    } catch (err) {
      console.error("Khalad ayaa dhacay markii PDF-ka la sameynayay:", err);
      alert("Khalad ayaa dhacay markii PDF-ka la sameynayay.");
    } finally {
      setDownloading(false);
    }
  };

  const hasPreparedRef = useRef(false);

  useEffect(() => {
    if (hasPreparedRef.current) return;
    hasPreparedRef.current = true;

    let cancelled = false;

    const prepareReceipt = async () => {
      try {
        // Halka lacagta laga aqbalayo (Classes.jsx) horeba way soo diyaarisay
        // lambar rasiid + xogtii buuxda ee Firestore-ka ku jirta — halkan
        // kaliya waa la isticmaalaa, laguma abuurayo mid labaad oo nuqul ah.
        if (payment.receiptNo) {
          if (!cancelled) {
            setReceiptNo(payment.receiptNo);
            setLoading(false);
          }
          return;
        }

        const no = await getNextReceiptNumber();
        if (cancelled) return;
        setReceiptNo(no);

        const paidDate = payment.createdAt?.seconds
          ? new Date(payment.createdAt.seconds * 1000)
          : new Date();
        await saveReceiptRecord(no, payment, paidDate);
      } catch (err) {
        console.log(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    prepareReceipt();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!payment) return null;

  const paidDate = payment.createdAt?.seconds
    ? new Date(payment.createdAt.seconds * 1000)
    : new Date();

  const dateStr = paidDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const totalPaidAmount =
    (Number(payment.paidAmount) || 0) + (Number(payment.creditAmount) || 0) ||
    Number(payment.totalPaid) ||
    Number(payment.paidAmount) ||
    0;

  const sosAmount = totalPaidAmount;
  const amountWords = amountToWords(totalPaidAmount);
  const monthDescription = payment.monthLabel || "Monthly Fee";

  return (
    <>
      <div className="receipt-overlay">
        <div className="receipt-modal-actions no-print">
          <button onClick={onClose} className="receipt-close-btn">
            Xir
          </button>
          <button onClick={() => window.print()} className="receipt-print-btn">
            🖨️ Print
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading || loading}
            className="receipt-pdf-btn"
          >
            {downloading ? "Diyaarinaya..." : "⬇️ PDF"}
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", padding: 20, fontSize: 12, color: "#fff" }}>
            Diyaarinaya rasiidka...
          </p>
        ) : (
          <div className="receipt-paper-container">
            <div className="receipt-bg-wrapper">
              <img src={receiptBgTemplate} alt="Receipt Background" className="receipt-bg-img" />

              <div className="receipt-overlay-data">
                <div className="r-no">{receiptNo}</div>
                <div className="r-date">{dateStr}</div>
                <div className="r-studentid">{payment.studentId || ""}</div>
                <div className="r-receivedfrom">{payment.studentName || ""}</div>
                <div className="r-amtsos">{sosAmount ? sosAmount.toLocaleString() : ""}</div>
                <div className="r-amtusd">{totalPaidAmount}</div>
                <div className="r-inwords">{amountWords} Only</div>
                <div className="r-beingof">{monthDescription}</div>
                <div className="r-class">{payment.className || "—"}</div>
                <div className="r-tel">{payment.studentPhone || payment.parentPhone || "—"}</div>
                <div className="r-evc-check">✓</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .receipt-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.65);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 12px;
        }

        .receipt-modal-actions { display: flex; gap: 10px; }
        .receipt-close-btn, .receipt-print-btn, .receipt-pdf-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .receipt-close-btn { background: #ffffff; color: #374151; border: 1px solid #d1d5db; }
        .receipt-print-btn { background: #16a34a; color: #ffffff; }
        .receipt-pdf-btn {
          background: #0b1f4d;
          color: #ffffff;
          opacity: ${downloading ? 0.7 : 1};
          cursor: ${downloading || loading ? "not-allowed" : "pointer"};
        }

        .receipt-paper-container {
          width: 750px;
          max-width: 95vw;
          background: #ffffff;
          position: relative;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          border-radius: 4px;
          overflow: hidden;
        }

        .receipt-bg-wrapper {
          position: relative;
          width: 100%;
          line-height: 0;
        }

        .receipt-bg-img {
          width: 100%;
          height: auto;
          display: block;
        }

        .receipt-overlay-data {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #0b1f4d;
        }

        .r-no {
          position: absolute;
          top: 44.8%;
          right: 5.2%;
          font-size: 15px;
          color: #dc2626;
          font-weight: 900;
        }

        .r-date {
          position: absolute;
          top: 51.8%;
          left: 11.5%;
          font-size: 11px;
        }

        .r-studentid {
          position: absolute;
          top: 56.0%;
          left: 13.8%;
          font-size: 11px;
          font-weight: 800;
        }

        .r-receivedfrom {
          position: absolute;
          top: 60.5%;
          left: 19%;
          font-size: 12px;
          font-weight: 800;
        }

        .r-amtsos {
          position: absolute;
          top: 67.5%;
          right: 17.5%;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
        }

        .r-amtusd {
          position: absolute;
          top: 67.5%;
          right: 5.5%;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
        }

        .r-inwords {
          position: absolute;
          top: 74.5%;
          left: 19.5%;
          font-size: 11px;
          font-weight: 600;
        }

        .r-beingof {
          position: absolute;
          top: 79.2%;
          left: 23%;
          font-size: 11px;
          font-weight: 600;
        }

        .r-class {
          position: absolute;
          top: 78.0%;
          right: 11.5%;
          font-size: 11px;
        }

        .r-tel {
          position: absolute;
          top: 83.3%;
          right: 13.5%;
          font-size: 11px;
        }

        .r-evc-check {
          position: absolute;
          top: 88.7%;
          left: 24.5%;
          transform: translate(-50%, -50%);
          font-size: 16px;
          font-weight: 900;
          color: #0b1f66;
          line-height: 1;
        }

        @media print {
  @page {
    size: 102mm 152mm portrait;
    margin: 0;
  }

  html,
  body {
    width: 102mm !important;
    height: 152mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    position: relative !important;
  }

  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body * {
    visibility: hidden !important;
  }

  .receipt-overlay,
  .receipt-overlay * {
    visibility: visible !important;
  }

  .receipt-overlay {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;

    width: 102mm !important;
    height: 152mm !important;

    margin: 0 !important;
    padding: 0 !important;

    background: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    transform: none !important;

    overflow: hidden !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .receipt-paper-container {
    position: static !important;
    box-sizing: border-box !important;

    width: 96mm !important;
    max-width: 96mm !important;
    max-height: 146mm !important;

    margin: 0 !important;
    padding: 0 !important;

    background: #ffffff !important;
    box-shadow: none !important;
    border: 2mm solid #0b1f4d !important;
    border-radius: 0 !important;

    overflow: hidden !important;
  }

  .receipt-bg-wrapper,
  .receipt-bg-img {
    width: 100% !important;
    height: auto !important;
  }

  .no-print {
    display: none !important;
  }
}
      `}</style>
    </>
  );
}