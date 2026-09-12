// src/admin/pages/Certificates.jsx
// Shahada Sharaf — Certificate of Honor.
//
// Flow:
// 1. Admin picks Student or Teacher, types the Student ID or Teacher
//    Username, presses Fetch. The system reads students/{id} or
//    teachers/{username} and auto-fills the recipient's fullName.
// 2. All wording on the certificate (Title, "Certificate of Honor",
//    the "Ardayga/Macalinka Mudan" label, the Hambalyo banner word,
//    the body paragraph, the tagline, and the issue date) is plain
//    editable text, defaulting to the template's own wording.
// 3. Generate saves to `honorCertificates` (doc id = safe
//    "{recipientType}-{lookupId}").

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import HonorCertificateCard, { HONOR_DEFAULTS } from "../components/HonorCertificateCard";

const GREEN = "#14532d";

function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
}

// Default issue-date text shown on a freshly opened Honor Certificate
// form — "10 September 2026" style, matching the template's own format.
function currentIssueDateLabel() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function emptyHonorForm() {
  return {
    recipientType: "student", // "student" | "teacher"
    lookupId: "", // Student ID or Teacher username
    fullName: "",
    title: HONOR_DEFAULTS.title,
    subtitle: HONOR_DEFAULTS.subtitle,
    hambalyoText: HONOR_DEFAULTS.hambalyoText,
    bodyText: HONOR_DEFAULTS.bodyText,
    tagline: HONOR_DEFAULTS.tagline,
    issueDate: currentIssueDateLabel(),
  };
}

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function downloadCertificateImage(name, elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    const rect = node.getBoundingClientRect();
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: document.documentElement.scrollWidth,
    });
    const link = document.createElement("a");
    link.download = `Certificate-${(name || "student").replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.log("Snapshot failed, falling back to print:", err);
    printCertificate(elementId);
  }
}

// Prints on a single clean A4 landscape page (the certificate is wider
// than tall), no browser header/footer padding, scaled to fill the page.
// Rebuilt to snapshot the certificate via html2canvas FIRST (same as the
// PDF/image downloads), then print that single flat image — this avoids
// the blank-page bug caused by the background template image and student
// photo (crossOrigin="anonymous") failing to (re)load inside a fresh
// about:blank print window with a different origin/base URL.
// One-time reminder (Chrome/Edge/etc. remember this choice per browser
// profile once set, so the admin only has to do it once ever): the
// date/title/URL/page-number strip you see in the print preview is added
// by the BROWSER'S print dialog, not by this page — no website CSS or JS
// is allowed to turn it off (Chrome blocks that for spoofing reasons).
// The fix lives in the print dialog itself: "More settings" → uncheck
// "Headers and footers". This just nudges the admin to do it once.
function maybeShowPrintHint() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (localStorage.getItem("certPrintHeaderHintShown")) return;
    window.alert(
      "Tallaabo hal mar ah, si warqadu u ahaato mid nadiif ah (aan lahayn taariikh/URL/lambar bog):\n\n" +
        "1) Marka daaqadda 'Print' soo baxdo, dhinaca bidix ee hoose riix 'More settings'.\n" +
        "2) DEMI (uncheck) sanduuqa 'Headers and footers'.\n" +
        "3) Kadibna riix Print.\n\n" +
        "Browser-ku (Chrome) wuu xasuusan doonaa doorashadan — uma baahnid inaad mar kale sameyso."
    );
    localStorage.setItem("certPrintHeaderHintShown", "1");
  } catch {
    // localStorage unavailable (private mode etc.) — safe to ignore
  }
}

async function printCertificate(elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  maybeShowPrintHint();
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    const rect = node.getBoundingClientRect();
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: document.documentElement.scrollWidth,
    });
    const imgData = canvas.toDataURL("image/png");

    const win = window.open("", "_blank", "width=1200,height=850");
    if (!win) {
      window.print();
      return;
    }
    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              width: 297mm;
              height: 210mm;
              overflow: hidden;
            }
            img {
              position: absolute;
              top: 0;
              left: 0;
              width: 297mm;
              height: 210mm;
              object-fit: fill;
              margin: 0;
            }
            @media print {
              html, body { width: 297mm; height: 210mm; }
            }
          </style>
        </head>
        <body>
          <img src="${imgData}" />
          <script>
            window.onload = function () {
              setTimeout(function () { window.focus(); window.print(); }, 300);
            };
            window.onafterprint = function () { window.close(); };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  } catch (err) {
    console.log("Print snapshot failed:", err);
  }
}

// Downloads a real A4-landscape PDF file (no print dialog) using
// html2canvas (snapshot the certificate) + jsPDF (place it on an A4
// landscape page, scaled to fill the page edge-to-edge). Both libs are
// lazy-loaded from CDN only once, then cached on `window`.
async function downloadCertificatePdf(name, elementId = "certificate-render-card") {
  const node = document.getElementById(elementId);
  if (!node) return;
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    const rect = node.getBoundingClientRect();
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: document.documentElement.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

    // Fit the certificate image edge-to-edge on the A4 landscape page,
    // preserving aspect ratio and centering it (letterboxed if the
    // certificate's own ratio isn't exactly 297:210).
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pageWidth / pageHeight;

    let drawWidth, drawHeight;
    if (imgRatio > pageRatio) {
      drawWidth = pageWidth;
      drawHeight = pageWidth / imgRatio;
    } else {
      drawHeight = pageHeight;
      drawWidth = pageHeight * imgRatio;
    }
    const offsetX = (pageWidth - drawWidth) / 2;
    const offsetY = (pageHeight - drawHeight) / 2;

    pdf.addImage(imgData, "PNG", offsetX, offsetY, drawWidth, drawHeight);
    pdf.save(`Certificate-${(name || "student").replace(/\s+/g, "-")}.pdf`);
  } catch (err) {
    console.log("PDF generation failed, falling back to print:", err);
    printCertificate(elementId);
  }
}

export default function Certificates() {
  const [honorCertificates, setHonorCertificates] = useState([]);
  const [honorLoading, setHonorLoading] = useState(true);
  const [honorSaving, setHonorSaving] = useState(false);
  const [honorFetching, setHonorFetching] = useState(false);
  const [honorFetchMsg, setHonorFetchMsg] = useState("");
  const [honorForm, setHonorForm] = useState(emptyHonorForm());
  const [previewHonorCert, setPreviewHonorCert] = useState(null);
  const [viewHonorCert, setViewHonorCert] = useState(null);
  const [honorSearch, setHonorSearch] = useState("");
  const [printingAllHonor, setPrintingAllHonor] = useState(false);

  useEffect(() => {
    loadHonor();
  }, []);

  async function loadHonor() {
    setHonorLoading(true);
    try {
      const snap = await getDocs(collection(db, "honorCertificates"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setHonorCertificates(list);
    } catch (e) {
      console.error("Error loading honor certificates:", e);
    } finally {
      setHonorLoading(false);
    }
  }

  // ── Shahada Sharaf: Student ID or Teacher username entered → read the
  // recipient's fullName from `students/{id}` or `teachers/{username}` ──
  async function handleFetchHonorRecipient() {
    const rawId = honorForm.lookupId.trim();
    if (!rawId) {
      setHonorFetchMsg(
        honorForm.recipientType === "teacher"
          ? "Fadlan geli Teacher Username-ka."
          : "Fadlan geli Student ID-ga."
      );
      return;
    }
    setHonorFetching(true);
    setHonorFetchMsg("");
    try {
      if (honorForm.recipientType === "teacher") {
        // Teachers collection is keyed by the teacher's username itself
        // (doc id = username, e.g. teachers/Jiimi), not a separate ID field.
        const teacherRef = doc(db, "teachers", rawId);
        const teacherSnap = await getDoc(teacherRef);
        if (!teacherSnap.exists()) {
          setHonorFetchMsg(`Macalin Username "${rawId}" lama helin (teachers).`);
          setHonorFetching(false);
          return;
        }
        const t = teacherSnap.data();
        setHonorForm((f) => ({ ...f, fullName: t.fullName || "" }));
        setHonorFetchMsg("✅ Magaca macalinka si toos ah ayaa loo soo aqriyay.");
      } else {
        const id = toSafeDocId(rawId);
        const studentRef = doc(db, "students", id);
        const studentSnap = await getDoc(studentRef);
        if (!studentSnap.exists()) {
          setHonorFetchMsg(`Arday Student ID "${rawId}" lama helin (students).`);
          setHonorFetching(false);
          return;
        }
        const st = studentSnap.data();
        setHonorForm((f) => ({
          ...f,
          lookupId: st.studentId || rawId,
          fullName: st.fullName || "",
        }));
        setHonorFetchMsg("✅ Magaca ardayga si toos ah ayaa loo soo aqriyay.");
      }
    } catch (e) {
      console.error("Honor fetch error:", e);
      setHonorFetchMsg("Khalad ayaa dhacay markii xogta la soo aqrinayay.");
    } finally {
      setHonorFetching(false);
    }
  }

  const filteredHonorCertificates = useMemo(() => {
    const q = honorSearch.trim().toLowerCase();
    if (!q) return honorCertificates;
    return honorCertificates.filter(
      (c) =>
        (c.fullName || "").toLowerCase().includes(q) ||
        (c.lookupId || "").toString().toLowerCase().includes(q)
    );
  }, [honorCertificates, honorSearch]);

  function resetHonorForm() {
    setHonorForm(emptyHonorForm());
    setHonorFetchMsg("");
  }

  async function handleGenerateHonor() {
    if (!honorForm.lookupId.trim()) {
      alert(
        honorForm.recipientType === "teacher"
          ? "Fadlan geli Teacher Username-ka."
          : "Fadlan geli Student ID-ga."
      );
      return;
    }
    if (!honorForm.fullName.trim()) {
      alert("Marka hore riix Fetch si magaca la soo aqriyo.");
      return;
    }
    setHonorSaving(true);
    try {
      const id = toSafeDocId(`${honorForm.recipientType}-${honorForm.lookupId}`);
      const certRef = doc(db, "honorCertificates", id);

      const existing = await getDoc(certRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Shahaado horeyba loo sameeyay ${honorForm.fullName}. Ma rabtaa inaad ku beddesho (overwrite)?`
        );
        if (!overwrite) {
          setHonorSaving(false);
          return;
        }
      }

      const certData = {
        recipientType: honorForm.recipientType,
        lookupId: honorForm.lookupId.trim(),
        fullName: honorForm.fullName.trim(),
        title: honorForm.title.trim(),
        subtitle: honorForm.subtitle.trim(),
        hambalyoText: honorForm.hambalyoText.trim(),
        bodyText: honorForm.bodyText.trim(),
        tagline: honorForm.tagline.trim(),
        issueDate: honorForm.issueDate.trim(),
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(certRef, certData);
      setPreviewHonorCert({ id, ...certData });
      resetHonorForm();
      await loadHonor();
    } catch (e) {
      console.error("Error saving honor certificate:", e);
      alert("Khalad ayaa dhacay markii shahaadada la keydin lahaa.");
    } finally {
      setHonorSaving(false);
    }
  }

  async function handleDeleteHonor(cert) {
    if (!window.confirm(`Ma hubtaa inaad tirtirto shahaadada ${cert.fullName}?`)) return;
    try {
      await deleteDoc(doc(db, "honorCertificates", cert.id));
      if (previewHonorCert?.id === cert.id) setPreviewHonorCert(null);
      if (viewHonorCert?.id === cert.id) setViewHonorCert(null);
      await loadHonor();
    } catch (e) {
      console.error("Error deleting honor certificate:", e);
    }
  }

  // "Print All" — asks whether to print every issued Honor Certificate or
  // just one (in which case the admin uses View → Print from the list
  // below instead). If "all" is chosen, every certificate is snapshotted
  // off-screen and printed as its own A4-landscape page in one print job.
  async function handlePrintAllHonor() {
    if (honorCertificates.length === 0) {
      alert("Weli shahaado lama sameyn.");
      return;
    }
    const printAll = window.confirm(
      `Ma rabtaa inaad daabacdo DHAMMAAN shahaadooyinka (${honorCertificates.length})?\n\nRiix OK si aad DHAMMAAN u daabacdo (qor kasta bog gooni ah, A4 landscape).\nRiix Cancel haddii aad rabto inaad mid gaar ah ka daabacdo liiska hoose (View → Print).`
    );
    if (!printAll) return;

    maybeShowPrintHint();
    setPrintingAllHonor(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const images = [];
      for (const cert of honorCertificates) {
        const node = document.getElementById(`bulk-print-honor-${cert.id}`);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const canvas = await window.html2canvas(node, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          allowTaint: false,
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
          windowWidth: document.documentElement.scrollWidth,
        });
        images.push(canvas.toDataURL("image/png"));
      }

      if (images.length === 0) {
        alert("Wax lama heli karin oo la daabaci karo.");
        return;
      }

      const win = window.open("", "_blank", "width=1200,height=850");
      if (!win) {
        alert("Fadlan u ogolow pop-up-yada browser-ka si aad u daabacdo.");
        return;
      }

      const pagesHtml = images
        .map(
          (src, i) =>
            `<div class="page"${i < images.length - 1 ? ' style="page-break-after: always;"' : ""}><img src="${src}" /></div>`
        )
        .join("\n");

      win.document.open();
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Certificates</title>
            <meta charset="utf-8" />
            <style>
              @page { size: A4 landscape; margin: 0; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              html, body { margin: 0; padding: 0; background: #fff; }
              .page {
                width: 297mm;
                height: 210mm;
                position: relative;
                overflow: hidden;
              }
              .page img {
                position: absolute;
                top: 0;
                left: 0;
                width: 297mm;
                height: 210mm;
                object-fit: fill;
                margin: 0;
              }
              @media print {
                .page { width: 297mm; height: 210mm; }
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
            <script>
              window.onload = function () {
                setTimeout(function () { window.focus(); window.print(); }, 400);
              };
              window.onafterprint = function () { window.close(); };
            <\/script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (err) {
      console.error("Print all failed:", err);
      alert("Khalad ayaa dhacay marka la daabacayay dhammaan shahaadooyinka.");
    } finally {
      setPrintingAllHonor(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F4F8", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: "22px 26px 0" }}>
          <Topbar />
        </div>

        <div style={{ padding: "26px 30px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>
            Shahada Sharaf — Certificate of Honor
          </h1>
          <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>
            Dooro Arday ama Macalin, geli ID-ga (Student ID ama Teacher
            Username), riix Fetch si magaca loo soo aqriyo. Qoraalka
            shahaadada oo dhan — Title-ka, Certificate of Honor, calaamadda
            "Ardayga/Macalinka Mudan", qoraalka Hambalyo, iyo taariikhda — waa
            la beddeli karaa gacanta ka hor inta aan shahaadada la sameynin.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }} className="cert-row">
            {/* Left: form */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                Certificate Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Recipient type */}
                <Field label="Nooca la siinayo (Student ama Teacher)">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        setHonorForm((f) => ({
                          ...f,
                          recipientType: "student",
                          lookupId: "",
                          fullName: "",
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 10,
                        border: honorForm.recipientType === "student" ? `1.5px solid ${GREEN}` : "1px solid rgba(17,24,39,0.12)",
                        background: honorForm.recipientType === "student" ? "#EFFBF3" : "#fff",
                        color: honorForm.recipientType === "student" ? GREEN : "#6B7280",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      🎓 Student
                    </button>
                    <button
                      onClick={() =>
                        setHonorForm((f) => ({
                          ...f,
                          recipientType: "teacher",
                          lookupId: "",
                          fullName: "",
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: "9px 0",
                        borderRadius: 10,
                        border: honorForm.recipientType === "teacher" ? `1.5px solid ${GREEN}` : "1px solid rgba(17,24,39,0.12)",
                        background: honorForm.recipientType === "teacher" ? "#EFFBF3" : "#fff",
                        color: honorForm.recipientType === "teacher" ? GREEN : "#6B7280",
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: "pointer",
                      }}
                    >
                      🧑‍🏫 Teacher
                    </button>
                  </div>
                </Field>

                {/* ID / Username + Fetch */}
                <Field
                  label={
                    honorForm.recipientType === "teacher"
                      ? "Teacher Username (gali kadibna riix Fetch)"
                      : "Student ID (gali kadibna riix Fetch)"
                  }
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={honorForm.lookupId}
                      onChange={(e) => setHonorForm({ ...honorForm, lookupId: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleFetchHonorRecipient(); }}
                      placeholder={honorForm.recipientType === "teacher" ? "e.g. Jiimi" : "e.g. 0024"}
                      style={inputStyle}
                    />
                    <button
                      onClick={handleFetchHonorRecipient}
                      disabled={honorFetching}
                      style={{ padding: "0 16px", borderRadius: 10, border: "none", background: honorFetching ? "#9CA3AF" : GREEN, color: "#fff", fontWeight: 700, fontSize: 13, cursor: honorFetching ? "default" : "pointer", whiteSpace: "nowrap" }}
                    >
                      {honorFetching ? "…" : "Fetch"}
                    </button>
                  </div>
                  {honorFetchMsg && (
                    <div style={{ marginTop: 6, fontSize: 12, color: honorFetchMsg.startsWith("✅") ? GREEN : "#B45309" }}>
                      {honorFetchMsg}
                    </div>
                  )}
                </Field>

                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid rgba(17,24,39,0.08)", fontSize: 12.5, color: "#374151" }}>
                  <b>Magaca:</b> {honorForm.fullName || "—"}
                </div>

                <Field label='Title (default: "SHAHADA SHARAF")'>
                  <input
                    value={honorForm.title}
                    onChange={(e) => setHonorForm({ ...honorForm, title: e.target.value })}
                    style={inputStyle}
                  />
                </Field>

                <Field label='Certificate of Honor (subtitle)'>
                  <input
                    value={honorForm.subtitle}
                    onChange={(e) => setHonorForm({ ...honorForm, subtitle: e.target.value })}
                    style={inputStyle}
                  />
                </Field>

                <Field label='Erayga Ribbon-ka (default: "HAMBALYO")'>
                  <input
                    value={honorForm.hambalyoText}
                    onChange={(e) => setHonorForm({ ...honorForm, hambalyoText: e.target.value })}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Qoraalka Hambalyeynta (body text)">
                  <textarea
                    value={honorForm.bodyText}
                    onChange={(e) => setHonorForm({ ...honorForm, bodyText: e.target.value })}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                </Field>

                <Field label="Tagline (hoosta qoraalka)">
                  <input
                    value={honorForm.tagline}
                    onChange={(e) => setHonorForm({ ...honorForm, tagline: e.target.value })}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Taariikhda la bixiyay (Date of Issue)">
                  <input
                    value={honorForm.issueDate}
                    onChange={(e) => setHonorForm({ ...honorForm, issueDate: e.target.value })}
                    placeholder="e.g. 10 September 2026"
                    style={inputStyle}
                  />
                </Field>
              </div>

              <button
                onClick={handleGenerateHonor}
                disabled={honorSaving}
                style={{ marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: honorSaving ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: honorSaving ? "default" : "pointer" }}
              >
                {honorSaving ? "Saving…" : "Generate Certificate"}
              </button>

              {previewHonorCert && (
                <>
                  <button onClick={() => downloadCertificateImage(previewHonorCert.fullName, "honor-certificate-render-card")} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    ⬇️ Download Certificate Image
                  </button>
                  <button onClick={() => downloadCertificatePdf(previewHonorCert.fullName, "honor-certificate-render-card")} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    📄 Download PDF
                  </button>
                  <button onClick={() => printCertificate("honor-certificate-render-card")} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    🖨️ Print Certificate
                  </button>
                </>
              )}
            </div>

            {/* Right: live preview */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14, alignSelf: "flex-start" }}>
                Preview
              </div>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <HonorCertificateCard
                  certificate={{
                    recipientType: honorForm.recipientType,
                    fullName: honorForm.fullName,
                    title: honorForm.title,
                    subtitle: honorForm.subtitle,
                    hambalyoText: honorForm.hambalyoText,
                    bodyText: honorForm.bodyText,
                    tagline: honorForm.tagline,
                    issueDate: honorForm.issueDate,
                  }}
                  elementId="honor-certificate-render-card"
                />
              </div>
            </div>
          </div>

          {/* Issued list */}
          <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)", marginTop: 22, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                Issued Certificates ({filteredHonorCertificates.length})
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={handlePrintAllHonor}
                  disabled={printingAllHonor}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: `1.5px solid ${GREEN}`,
                    background: printingAllHonor ? "#EFFBF3" : "#fff",
                    color: GREEN,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: printingAllHonor ? "default" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {printingAllHonor ? "Diyaarinaya…" : "🖨️ Print All"}
                </button>
                <input value={honorSearch} onChange={(e) => setHonorSearch(e.target.value)} placeholder="Search by name or ID…" style={{ ...inputStyle, width: 260 }} />
              </div>
            </div>
            {honorLoading ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
            ) : filteredHonorCertificates.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No certificates issued yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Nooca</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>ID</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Issued</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHonorCertificates.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{c.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{c.recipientType === "teacher" ? "Teacher" : "Student"}</td>
                      <td style={{ color: "#6B7280", fontFamily: "monospace" }}>{c.lookupId || c.id}</td>
                      <td style={{ color: "#6B7280" }}>{formatDate(c.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setViewHonorCert(c)} style={smallBtnStyle}>View</button>
                          <button onClick={() => handleDeleteHonor(c)} style={{ ...smallBtnStyle, color: "#DC2626", borderColor: "rgba(220,38,38,0.3)" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      {/* Off-screen batch render for "Print All" — one HonorCertificateCard
          per issued certificate, rendered off-screen so html2canvas can
          snapshot each one individually without disturbing the visible UI. */}
      <div style={{ position: "fixed", top: -99999, left: -99999, pointerEvents: "none" }} aria-hidden="true">
        {honorCertificates.map((cert) => (
          <HonorCertificateCard key={cert.id} certificate={cert} elementId={`bulk-print-honor-${cert.id}`} />
        ))}
      </div>

      {/* View modal — Shahada Sharaf / Certificate of Honor */}
      {viewHonorCert && (
        <div onClick={() => setViewHonorCert(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 16px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(1200px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>{viewHonorCert.fullName} — Certificate</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => downloadCertificateImage(viewHonorCert.fullName, "honor-certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>⬇️ Download</button>
                <button onClick={() => downloadCertificatePdf(viewHonorCert.fullName, "honor-certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>📄 PDF</button>
                <button onClick={() => printCertificate("honor-certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>🖨️ Print</button>
                <button onClick={() => setViewHonorCert(null)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(17,24,39,0.15)", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>✕ Close</button>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <HonorCertificateCard certificate={viewHonorCert} elementId="honor-certificate-view-modal-card" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .cert-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(17,24,39,0.12)",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
};

const smallBtnStyle = {
  padding: "5px 12px",
  borderRadius: 8,
  border: "1px solid rgba(17,24,39,0.12)",
  background: "#fff",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  cursor: "pointer",
};