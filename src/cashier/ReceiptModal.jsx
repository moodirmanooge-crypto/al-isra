import { useEffect, useState } from "react";
import {
  doc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { theme } from "./theme.js";
import schoolLogo from "../assets/logo.png";
import principalSignature from "../admin/assets/signature-principal.png";

const SCHOOL_NAME_LINE1 = "DUGSIGA HOOSE / DHEXE &";
const SCHOOL_NAME_LINE2 = "SARE EE AL-ISRA";
const SCHOOL_LOCATION = "Muqdisho - Soomaaliya";

const ARABIC_LINE1 = "مدرسة الإسراء";
const ARABIC_LINE2 = "الأساسية والثانوية";
const ARABIC_LOCATION = "مقديشو - الصومال";

const SCHOOL_PHONES = "858516 / 0615860629 / 0617536460 / 0617536461";
const SCHOOL_EMAIL = "israpp@hotmail.com";

const USD_TO_SOS_RATE = 28;

const academicYearLabel = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  if (m >= 9) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
};

function calculateMonthRange(receipt) {
  const startMonthStr = receipt.monthLabel || "";
  const totalAmount =
    (Number(receipt.paidAmount) || 0) + (Number(receipt.creditAmount) || 0) ||
    Number(receipt.totalPaid) ||
    Number(receipt.paidAmount) ||
    0;
  const monthlyFee = Number(receipt.monthlyFee) || 19;

  const monthCount = Math.max(1, Math.round(totalAmount / monthlyFee));

  if (!startMonthStr && !receipt.paidAt && !receipt.createdAt) {
    return "Monthly Fee";
  }

  let startDate = new Date();
  if (receipt.paidAt?.seconds) {
    startDate = new Date(receipt.paidAt.seconds * 1000);
  } else if (receipt.createdAt?.seconds) {
    startDate = new Date(receipt.createdAt.seconds * 1000);
  }

  if (startMonthStr) {
    const parsedDate = new Date(Date.parse(startMonthStr));
    if (!isNaN(parsedDate.getTime())) {
      startDate = parsedDate;
    }
  }

  if (monthCount <= 1) {
    return `Monthly Fee — ${
      startMonthStr ||
      startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    }`;
  }

  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + monthCount - 1,
    1
  );

  const startFormatted = startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const endFormatted = endDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return `Monthly Fee — ${startFormatted} to ${endFormatted} (${monthCount} Months)`;
}

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

  const nextNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    const current = counterDoc.exists() ? Number(counterDoc.data().value || 0) : 0;
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
      parentPhone: payment.parentPhone || payment.studentPhone || "",
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
  const [receiptNo, setReceiptNo] = useState("001");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const prepareReceipt = async () => {
      try {
        if (payment?.receiptNo) {
          setReceiptNo(String(payment.receiptNo).padStart(3, "0"));
          setLoading(false);
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
        console.error("Error generating receipt number:", err);
        setReceiptNo("001");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    prepareReceipt();

    return () => {
      cancelled = true;
    };
  }, [payment]);

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

  const sosAmount = Math.round(totalPaidAmount * USD_TO_SOS_RATE);
  const amountWords = amountToWords(totalPaidAmount);
  const monthDescription = calculateMonthRange(payment);
  const isEvc = true;

  const renderSingleReceipt = () => (
    <div className="rc-frame">
      <div className="rc-outer">
        <div className="rc-header-container">
          <div className="rc-header-top">
            <div className="rc-header-som">
              <div className="rc-som-title">{SCHOOL_NAME_LINE1}</div>
              <div className="rc-som-title">{SCHOOL_NAME_LINE2}</div>
              <div className="rc-som-sub">{SCHOOL_LOCATION}</div>
            </div>
            <div className="rc-header-ara">
              <div className="rc-ara-title">{ARABIC_LINE1}</div>
              <div className="rc-ara-title">{ARABIC_LINE2}</div>
              <div className="rc-ara-sub">{ARABIC_LOCATION}</div>
            </div>
          </div>
          <div className="rc-header-full-name">
            DUGSIGA HOOSE / DHEXE & SARE EE AL-ISRA
          </div>
          <div className="rc-header-contact">
            Tel. {SCHOOL_PHONES} E-mail: {SCHOOL_EMAIL}
          </div>
        </div>

        <div className="rc-divider" />

        <div className="rc-body">
          <div className="rc-voucher-row">
            <div className="rc-voucher-title">
              RECEIPT VOUCHER
              <div className="rc-voucher-sub">(Warqadda Lacag Qabashada)</div>
            </div>
            <div className="rc-no">
              Nº &nbsp;<span className="rc-no-value">{receiptNo || "001"}</span>
            </div>
          </div>

          <div className="rc-field">
            <span className="rc-label">Date:</span>
            <span className="rc-value">{dateStr}</span>
          </div>

          <div className="rc-student-id-line">
            <span className="rc-label">Student ID:</span>
            <span className="rc-id-inline-val">{payment.studentId || "—"}</span>
          </div>

          <div className="rc-field-block">
            <div className="rc-field-top">
              <span className="rc-label">Received from:</span>
              <span className="rc-value rc-value-strong">{payment.studentName}</span>
            </div>
            <div className="rc-field-caption">(Laga qaday)</div>
          </div>

          <div className="rc-amount-block">
            <div className="rc-amount-top">
              <span className="rc-label">Amount of So Sh.</span>
              <span className="rc-amount-box-sos">{sosAmount.toLocaleString()}</span>
              <span className="rc-usd-group">
                <span className="rc-usd-tag">US$</span>
                <span className="rc-amount-box-usd">{totalPaidAmount}</span>
              </span>
            </div>
            <div className="rc-field-caption">(Lacag dhan)</div>
          </div>

          <div className="rc-field">
            <span className="rc-label">
              In words <em>(Eray ahaan)</em>:
            </span>
            <span className="rc-value">{amountWords} Only</span>
          </div>

          <div className="rc-being-row">
            <div className="rc-being-of">
              <span className="rc-label">
                Being of: <em>(Taasoo ah)</em>:
              </span>
              <span className="rc-value">{monthDescription}</span>
            </div>
            <div className="rc-side-fields">
              <div className="rc-field-inline">
                <span className="rc-label">Class:</span>
                <span className="rc-value">{payment.className || "—"}</span>
              </div>
              <div className="rc-field-inline">
                <span className="rc-label">Tel.</span>
                <span className="rc-value">{payment.parentPhone || "—"}</span>
              </div>
            </div>
          </div>

          <div className="rc-bottom-row">
            <div className="rc-payment-method">
              <span className="rc-method-tag">PAYMENT METHOD</span>
              <span className="rc-evc-label">EVC</span>
              <span className={`rc-evc-box ${isEvc ? "rc-evc-checked" : ""}`}>
                {isEvc ? "✓" : ""}
              </span>
            </div>

            <img src={schoolLogo} alt="Stamp" className="rc-stamp" />

            <div className="rc-signature">
              <div className="rc-sig-title">PRINCIPAL SIGNATURE</div>
              <img src={principalSignature} alt="Principal Signature" className="rc-sig-img" />
              <div className="rc-sig-line" />
            </div>
          </div>
        </div>

        <div className="rc-footer-note">
          <span className="rc-footer-icon">!</span> N.B. NOT REFUNDABLE.
        </div>
      </div>
    </div>
  );

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
        </div>

        <div className="receipt-paper">
          {loading ? (
            <p style={{ textAlign: "center", padding: 20, fontSize: 12 }}>
              Diyaarinaya rasiidka...
            </p>
          ) : (
            renderSingleReceipt()
          )}
        </div>
      </div>

      <style>{`
        .receipt-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          gap: 14px;
        }

        .receipt-modal-actions {
          display: flex;
          gap: 10px;
        }

        .receipt-close-btn, .receipt-print-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }

        .receipt-close-btn {
          background: #ffffff;
          color: ${theme.colors.inkMuted || "#6B7280"};
          border: 1px solid ${theme.colors.border || "#E5E7EB"};
        }

        .receipt-print-btn {
          background: ${theme.colors.mint || "#16a34a"};
          color: #ffffff;
        }

        /* A5 Landscape: 148mm x 210mm (landscape) */
        .receipt-paper {
          width: 210mm;
          height: 148mm;
          max-width: 95vw;
          max-height: 85vh;
          overflow: auto;
          background: #ffffff;
          padding: 4mm;
          box-sizing: border-box;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
          color: #0b1f4d;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }

        .rc-frame {
          border: 2px solid #0b1f4d;
          padding: 2px;
          height: 100%;
          box-sizing: border-box;
        }

        .rc-outer {
          border: 2px solid #0b1f4d;
          padding: 6px 10px;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .rc-header-container {
          display: flex;
          flex-direction: column;
          gap: 0px;
        }
        .rc-header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          width: 100%;
        }
        .rc-header-som { text-align: left; }
        .rc-som-title {
          font-weight: 900;
          font-size: 13px;
          color: #0b1f4d;
          line-height: 1.1;
          text-transform: uppercase;
        }
        .rc-som-sub {
          font-style: italic;
          font-size: 10px;
          color: #1e3a8a;
          margin-top: 1px;
        }
        .rc-header-ara { text-align: right; direction: rtl; }
        .rc-ara-title {
          font-weight: 900;
          font-size: 15px;
          color: #0b1f4d;
          line-height: 1.1;
          font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
        }
        .rc-ara-sub {
          font-size: 10px;
          color: #1e3a8a;
          margin-top: 1px;
          font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
        }
        .rc-header-full-name {
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          color: #0b1f4d;
          margin-top: 2px;
          text-transform: uppercase;
        }
        .rc-header-contact {
          text-align: center;
          font-size: 9px;
          font-weight: 800;
          color: #0b1f4d;
          margin-top: 1px;
        }

        .rc-student-id-line {
          display: flex; align-items: center; gap: 6px; font-size: 10.5px; margin-top: 1px; margin-bottom: 1px;
        }
        .rc-id-inline-val {
          font-weight: 800; color: #0b1f4d; font-size: 11px; letter-spacing: 0.5px;
          border-bottom: 1px solid #64748b; padding: 0 6px;
        }

        .rc-divider { border-top: 1.5px solid #0b1f4d; margin: 3px 0; }
        .rc-body { display: flex; flex-direction: column; gap: 3px; flex: 1; justify-content: space-around; }
        .rc-voucher-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1px; }
        .rc-voucher-title {
          font-weight: 900; font-size: 13px; letter-spacing: 0.5px; color: #0b1f4d;
          text-align: center; flex: 1;
        }
        .rc-voucher-sub { font-size: 9px; font-style: italic; font-weight: 600; color: #1e3a8a; margin-top: 1px; }
        .rc-no { font-size: 10.5px; font-weight: 800; color: #0b1f4d; white-space: nowrap; }
        .rc-no-value { color: #dc2626; font-weight: 900; font-size: 13px; }
        .rc-field { display: flex; align-items: baseline; gap: 4px; font-size: 10px; }
        .rc-field em { font-size: 8.5px; font-style: italic; color: #475569; font-weight: 400; }
        .rc-label { font-weight: 700; white-space: nowrap; color: #0b1f4d; }
        .rc-value {
          flex: 1; border-bottom: 1px solid #64748b; padding-bottom: 1px; font-weight: 600; min-height: 12px;
        }
        .rc-value-strong { font-weight: 800; font-size: 11.5px; text-align: center; color: #0b1f4d; }
        .rc-field-block, .rc-amount-block { display: flex; flex-direction: column; gap: 1px; }
        .rc-field-top { display: flex; align-items: baseline; gap: 4px; font-size: 10px; }
        .rc-field-caption { font-style: italic; font-size: 8px; color: #475569; margin-top: 1px; }
        .rc-amount-top { display: flex; align-items: stretch; gap: 6px; }
        .rc-amount-top .rc-label { align-self: center; }
        .rc-amount-box-sos {
          flex: 1; border: 1.5px solid #0b1f4d; border-radius: 4px; padding: 2px 6px;
          font-weight: 800; font-size: 10px; text-align: right;
          display: flex; align-items: center; justify-content: flex-end;
        }
        .rc-usd-group {
          display: flex; align-items: stretch; border: 1.5px solid #0b1f4d; border-radius: 4px;
          overflow: hidden; flex-shrink: 0;
        }
        .rc-usd-tag {
          background: #0b1f4d; color: #fff; font-weight: 800; font-size: 8.5px;
          padding: 2px 5px; display: flex; align-items: center;
        }
        .rc-amount-box-usd {
          padding: 2px 6px; font-weight: 800; font-size: 10px;
          min-width: 32px; text-align: right; display: flex; align-items: center; justify-content: flex-end;
        }
        .rc-being-row { display: flex; gap: 8px; }
        .rc-being-of { flex: 1; display: flex; align-items: baseline; gap: 4px; font-size: 10px; }
        .rc-side-fields { display: flex; flex-direction: column; gap: 2px; min-width: 95px; }
        .rc-field-inline { display: flex; align-items: baseline; gap: 4px; font-size: 9.5px; }
        .rc-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
        .rc-payment-method { display: flex; align-items: center; gap: 4px; }
        .rc-method-tag {
          background: #0b1f4d; color: #fff; font-size: 8px; font-weight: 800;
          padding: 2px 4px; border-radius: 3px; white-space: nowrap;
        }
        .rc-evc-label { font-weight: 700; font-size: 9px; color: #0b1f4d; }
        .rc-evc-box {
          width: 14px; height: 14px; border: 1.5px solid #0b1f4d; border-radius: 3px;
          display: inline-flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 9.5px; color: #16a34a;
        }
        .rc-stamp { width: 38px; height: 38px; object-fit: contain; opacity: 0.85; flex-shrink: 0; }
        .rc-signature { text-align: center; min-width: 95px; }
        .rc-sig-title { font-size: 7.5px; font-weight: 800; color: #0b1f4d; letter-spacing: 0.2px; }
        .rc-sig-img { height: 17px; object-fit: contain; margin-top: 1px; }
        .rc-sig-line { border-bottom: 1.5px solid #0b1f4d; margin-top: 1px; }

        .rc-footer-note {
          background: #0b1f4d;
          color: #fff;
          font-size: 9.5px;
          font-weight: 900;
          padding: 3px 6px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .rc-footer-icon {
          width: 12px; height: 12px; background: #fff; color: #0b1f4d;
          border-radius: 50%; display: inline-flex; align-items: center;
          justify-content: center; font-weight: 900; font-size: 8.5px; flex-shrink: 0;
        }

        @media print {
          @page {
            size: 210mm 148mm;
            margin: 0;
          }

          html,
          body {
            width: 210mm !important;
            height: 148mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          body * {
            visibility: hidden !important;
          }

          .receipt-paper,
          .receipt-paper * {
            visibility: visible !important;
          }

          .receipt-overlay {
            position: static !important;
            display: block !important;
            width: 210mm !important;
            height: 148mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: hidden !important;
          }

          .receipt-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;

            width: 210mm !important;
            height: 148mm !important;

            min-width: 210mm !important;
            min-height: 148mm !important;
            max-width: none !important;
            max-height: none !important;

            margin: 0 !important;
            padding: 3mm !important;

            box-sizing: border-box !important;
            overflow: hidden !important;

            background: #ffffff !important;
            box-shadow: none !important;

            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .receipt-paper .rc-frame {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }

          .receipt-paper .rc-outer {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }

          .no-print {
            display: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}