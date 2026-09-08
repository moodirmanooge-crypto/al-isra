// src/admin/pages/Certificates.jsx
// Class Leaving Certificate — AUTO-READ version.
//
// The real printed template (certificate-template.png) has a SINGLE
// 6-row subjects table (No / Subject / Marks — row numbers 1-6 are
// already printed on the template image itself), NOT separate Somali
// and English tables. So there is only ONE `subjects` list now.
//
// Flow:
// 1. Admin types Roll Number (= Student ID), then presses Fetch. The
//    system reads:
//      students/{rollNumber} -> fullName, motherName (parentName),
//         placeOfBirth, dateOfBirth, studentPhoto — all auto-filled.
//         rollNumber itself is then forced to the real students.studentId
//         value, so what's shown always matches the actual Student ID.
//      results (where studentId==id) -> ALL "results" docs for that
//         student, keeps only rows where:
//           - className is in the Class-8 group ("8"/"G8"/"G8 A"/"G8 B",
//             any casing/spacing) OR the Secondary group ("F4" and any
//             subdivision like "F4 A"/"F4 B"),
//           - examType loosely matches "final" (covers "Final",
//             "Final Exam", etc. — the exact label varies in Firestore),
//           - the student actually PASSED (marks >= 50% of maxMarks).
//         Sorts the passed rows by marks DESC, keeps the TOP 6 subjects.
//         Those 6 auto-fill the single subjects table. This is
//         READ-ONLY / automatic; the admin cannot type subjects by hand.
// 2. Year defaults to the current school year ("2026-2027" style, from
//    today's calendar year), School Name defaults to the school's full
//    name — both remain plain editable text fields.
// 3. Result Average is auto-computed from the 6 auto-filled marks.
// 4. Generate saves to `certificates` (doc id = safe Roll Number).
//
// ⚠️ FIELD NAMES CONFIRMED FROM YOUR FIRESTORE SCREENSHOT (results doc):
//    className, examId, examType, marks, maxMarks, studentId,
//    studentName, subject, teacherId, teacherName, updatedAt.
//    Each results doc = ONE subject's mark for ONE student/exam.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query as fsQuery,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../../firebase/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import CertificateCard from "../components/CertificateCard";

const GREEN = "#14532d";
const SUBJECT_COUNT = 6; // the real template has a single 6-row table
const PASS_RATIO = 0.5; // a subject counts as "passed" at >= 50% of maxMarks
const VERIFY_BASE_URL =
  typeof window !== "undefined" ? `${window.location.origin}/verify` : "/verify";

// Class-8 group: "8", "G8", "G8 A", "G8 B" (any spacing/case) — these are
// all treated as the SAME eligible class for this certificate. Secondary
// group: "F4" and any of its subdivisions ("F4 A", "F4 B", ...). A result
// row is eligible if its className falls in EITHER group.
function isEligibleCertificateClass(className) {
  const c = String(className || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!c) return false;
  if (c === "8" || c.startsWith("G8")) return true;
  if (c.startsWith("F4")) return true;
  return false;
}

// examType is stored inconsistently across the app ("Final", "final",
// "Final Exam") — match loosely on "final" so all of them count.
function isFinalExamType(examType) {
  return String(examType || "").toLowerCase().includes("final");
}

// A subject counts as "passed" once marks reach PASS_RATIO of maxMarks.
// If maxMarks is missing/zero we can't judge pass/fail, so it's kept in
// (better to surface it than silently drop a real result).
function hasPassed(row) {
  const marks = Number(row.marks);
  const maxMarks = Number(row.maxMarks);
  if (Number.isNaN(marks)) return false;
  if (!maxMarks) return true;
  return marks >= maxMarks * PASS_RATIO;
}

// Default school-year label shown on the certificate — e.g. today in
// 2026 shows "2026-2027". Still a plain editable text field, this is
// only the starting value.
function currentSchoolYearLabel() {
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
}

function emptySubjects(count = SUBJECT_COUNT) {
  return Array.from({ length: count }, () => ({ name: "", marks: "" }));
}

function emptyForm() {
  return {
    rollNumber: "",
    dateOfBirth: "",
    issueDate: "",
    // Auto-filled (read-only) from Firestore on Fetch:
    fullName: "",
    motherName: "",
    placeOfBirth: "",
    // Typed by hand (year defaults to the current school year):
    completedSchool: "AL - ISRA Primary & Secondary School",
    year: currentSchoolYearLabel(),
  };
}

function toSafeDocId(rawId) {
  return rawId.trim().replace(/[\/\s]+/g, "-");
}

// Averages the 6 auto-filled marks. Blank/empty marks are correctly
// excluded so they don't drag the average down toward 0.
function computeAverage(subjects) {
  const marks = subjects
    .map((s) => (s?.marks ?? "").toString().trim())
    .filter((v) => v !== "")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));

  if (marks.length === 0) return "";
  const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
  return Math.round(avg * 10) / 10;
}

function formatDate(d) {
  if (!d) return "—";
  const dateObj = d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fileToResizedDataUrl(file, maxEdge = 500, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxEdge) {
          height = Math.round((height * maxEdge) / width);
          width = maxEdge;
        } else if (height > maxEdge) {
          width = Math.round((width * maxEdge) / height);
          height = maxEdge;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
async function printCertificate(elementId = "certificate-render-card") {
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
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  const [form, setForm] = useState(emptyForm());
  // Single subjects table — 6 rows, always auto-read from Firestore on
  // Fetch (top 6 PASSED subjects by marks). Read-only, matches the
  // template's one 6-row table exactly.
  const [subjects, setSubjects] = useState(emptySubjects(SUBJECT_COUNT));
  const [photo, setPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState(null);

  const [previewCert, setPreviewCert] = useState(null);
  const [viewCert, setViewCert] = useState(null);
  const [search, setSearch] = useState("");

  const resultAverage = useMemo(() => computeAverage(subjects), [subjects]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "certificates"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setCertificates(list);
    } catch (e) {
      console.error("Error loading certificates:", e);
    } finally {
      setLoading(false);
    }
  }

  // ── Roll Number entered → read student + auto top-6 PASSED Final subjects ──
  async function handleFetchStudent() {
    const roll = form.rollNumber.trim();
    if (!roll) {
      setFetchMsg("Fadlan geli Roll Number.");
      return;
    }
    setFetching(true);
    setFetchMsg("");
    try {
      const id = toSafeDocId(roll);

      // 1) Read the student document: students/{rollNumber}
      const studentRef = doc(db, "students", id);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) {
        setFetchMsg(`Arday Roll Number "${roll}" lama helin (students).`);
        setFetching(false);
        return;
      }
      const st = studentSnap.data();
      const fullName = st.fullName || "";
      const motherName = st.motherName || st.parentName || "";
      const placeOfBirth = st.placeOfBirth || "";
      const dateOfBirth = st.dateOfBirth || "";
      const studentPhoto = st.studentPhoto || "";
      // Roll Number-ka la muujinayo waa in ay had iyo jeer noqoto isla
      // Student ID-ga sax ah ee xogta laga soo aqriyay — ha ahaato sida
      // laga qoray sanduuqa Fetch (case/whitespace-ka).
      const realRollNumber = st.studentId || roll;

      // 2) Read ALL `results` docs for this student, keep only rows in the
      //    Class-8 group ("8"/"G8"/"G8 A"/"G8 B") OR the F4 group
      //    ("F4"/"F4 A"/"F4 B"), with a Final exam type, AND that the
      //    student actually PASSED — sort by marks DESC, take the top 6.
      const rq = fsQuery(collection(db, "results"), where("studentId", "==", id));
      const rSnap = await getDocs(rq);
      const rows = rSnap.docs.map((d) => d.data());

      const finalRows = rows.filter(
        (r) =>
          isEligibleCertificateClass(r.className) &&
          isFinalExamType(r.examType) &&
          hasPassed(r)
      );

      const top6 = [...finalRows]
        .sort((a, b) => (Number(b.marks) || 0) - (Number(a.marks) || 0))
        .slice(0, SUBJECT_COUNT)
        .map((r) => ({
          name: r.subject || "",
          marks: r.marks !== undefined && r.marks !== null ? String(r.marks) : "",
        }));

      // Pad to exactly 6 rows so the table always has 6 slots, matching
      // the template's fixed 6-row layout.
      const padded6 = Array.from({ length: SUBJECT_COUNT }, (_, i) => top6[i] || { name: "", marks: "" });

      setForm((f) => ({
        ...f,
        rollNumber: realRollNumber,
        fullName,
        motherName,
        placeOfBirth,
        dateOfBirth,
      }));
      setSubjects(padded6);
      // Sawirka ardayga si toos ah ayaa looga soo aqrinayaa xogta
      // students/{id} — haddii uu jiro. Admin-ku weli wuu iska badali
      // karaa gacanta (Upload Photo) haddii uu rabo mid kale.
      if (studentPhoto) setPhoto(studentPhoto);

      if (finalRows.length === 0) {
        setFetchMsg(
          "⚠️ Ardayga waa la helay, laakiin natiijo Final ah oo uu ku baasay lama helin — maadooyinka lama soo aqrin karin."
        );
      } else {
        setFetchMsg(
          `✅ Xogta ardayga la soo aqriyay — ${Math.min(finalRows.length, SUBJECT_COUNT)} maado oo uu ku baasay oo ugu sarreeya marks ayaa si toos ah loo buuxiyay.`
        );
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setFetchMsg("Khalad ayaa dhacay markii xogta la soo aqrinayay.");
    } finally {
      setFetching(false);
    }
  }

  const filteredCertificates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return certificates;
    return certificates.filter(
      (c) =>
        (c.fullName || "").toLowerCase().includes(q) ||
        (c.rollNumber || c.id || "").toString().toLowerCase().includes(q)
    );
  }, [certificates, search]);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Fadlan dooro sawir (image file) sax ah.");
      return;
    }
    setPhotoFile(file);
    fileToResizedDataUrl(file)
      .then(setPhoto)
      .catch(() => alert("Sawirka lama akhriyi karin. Isku day mid kale."));
  }

  function resetForm() {
    setForm(emptyForm());
    setSubjects(emptySubjects(SUBJECT_COUNT));
    setPhoto("");
    setPhotoFile(null);
    setFetchMsg("");
  }

  async function handleGenerate() {
    if (!form.rollNumber.trim()) {
      alert("Fadlan geli Roll Number.");
      return;
    }
    if (!form.fullName.trim()) {
      alert("Marka hore riix Fetch si magaca ardayga loo soo aqriyo Roll Number-ka.");
      return;
    }
    setSaving(true);
    try {
      const id = toSafeDocId(form.rollNumber);
      const certRef = doc(db, "certificates", id);

      const existing = await getDoc(certRef);
      if (existing.exists()) {
        const overwrite = window.confirm(
          `Roll Number "${form.rollNumber}" horeyba shahaado ayaa loo sameeyay. Ma rabtaa inaad ku beddesho (overwrite)?`
        );
        if (!overwrite) {
          setSaving(false);
          return;
        }
      }

      let photoUrl = existing.exists() ? existing.data().studentPhoto || "" : "";
      if (photoFile) {
        setUploadingPhoto(true);
        try {
          const photoRef = ref(storage, `certificate-photos/${id}/${Date.now()}_${photoFile.name}`);
          await uploadBytes(photoRef, photoFile);
          photoUrl = await getDownloadURL(photoRef);
        } finally {
          setUploadingPhoto(false);
        }
      } else if (photo) {
        photoUrl = photo;
      }

      const cleanSubjects = subjects
        .filter((s) => s.name.trim() || s.marks.toString().trim())
        .map((s) => ({ name: s.name.trim(), marks: s.marks.toString().trim() }));

      const certData = {
        fullName: form.fullName.trim(),
        motherName: form.motherName.trim(),
        placeOfBirth: form.placeOfBirth.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        completedSchool: form.completedSchool.trim(),
        year: form.year.trim(),
        rollNumber: form.rollNumber.trim(),
        issueDate: form.issueDate.trim(),
        resultAverage: resultAverage === "" ? "" : resultAverage,
        subjects: cleanSubjects,
        studentPhoto: photoUrl,
        createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(certRef, certData);
      setPreviewCert({ id, ...certData });
      resetForm();
      await load();
    } catch (e) {
      console.error("Error saving certificate:", e);
      alert("Khalad ayaa dhacay markii shahaadada la keydin lahaa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cert) {
    if (!window.confirm(`Ma hubtaa inaad tirtirto shahaadada ${cert.fullName}?`)) return;
    try {
      await deleteDoc(doc(db, "certificates", cert.id));
      if (previewCert?.id === cert.id) setPreviewCert(null);
      if (viewCert?.id === cert.id) setViewCert(null);
      await load();
    } catch (e) {
      console.error("Error deleting certificate:", e);
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
            Class Leaving Certificates
          </h1>
          <p style={{ fontSize: 13.5, color: "#6B7280", margin: "0 0 24px" }}>
            Geli Roll Number-ka (= Student ID), riix Fetch — magaca, magaca
            hooyada, goobta iyo taariikhda dhalashada, sawirka ardayga, iyo
            6-ka maado ee English-ka ee ugu sarreeya marks (natiijada Final
            ee uu ardaygu ku baasay, Class 8 ama F4) waa la soo aqrinayaa si
            toos ah, oo laba jibbaaran si loo buuxiyo dhammaan 12-ka saf.
            Sanadka dugsiyeedka wuxuu si toos ah u bilaabmaa sanadka hadda
            (waana la beddeli karaa). Magaca Dugsiga iyo 12-ka Maado ee
            Soomaaliga ayaa gacanta lagu qoraa.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 22 }} className="cert-row">
            {/* Left: form */}
            <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                Certificate Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Roll Number + Fetch */}
                <Field label="Roll Number (gali kadibna riix Fetch)">
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={form.rollNumber}
                      onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleFetchStudent(); }}
                      placeholder="e.g. 0006"
                      style={inputStyle}
                    />
                    <button
                      onClick={handleFetchStudent}
                      disabled={fetching}
                      style={{ padding: "0 16px", borderRadius: 10, border: "none", background: fetching ? "#9CA3AF" : GREEN, color: "#fff", fontWeight: 700, fontSize: 13, cursor: fetching ? "default" : "pointer", whiteSpace: "nowrap" }}
                    >
                      {fetching ? "…" : "Fetch"}
                    </button>
                  </div>
                  {fetchMsg && (
                    <div style={{ marginTop: 6, fontSize: 12, color: fetchMsg.startsWith("✅") ? GREEN : "#B45309" }}>
                      {fetchMsg}
                    </div>
                  )}
                </Field>

                {/* Auto-filled read-only summary */}
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "#F9FAFB", border: "1px solid rgba(17,24,39,0.08)", fontSize: 12.5, color: "#374151", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div><b>Magaca:</b> {form.fullName || "—"}</div>
                  <div><b>Magaca Hooyada:</b> {form.motherName || "—"}</div>
                  <div><b>Goobta Dhalashada:</b> {form.placeOfBirth || "—"}</div>
                  <div><b>Taariikhda Dhalashada:</b> {form.dateOfBirth || "—"}</div>
                </div>

                {/* Manual: Year + School Name */}
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Year / Sanadka (toos ah, la beddeli karaa)">
                    <input
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                      placeholder="e.g. 2026-2027"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="School Name / Magaca Dugsiga (gacanta)">
                    <input
                      value={form.completedSchool}
                      onChange={(e) => setForm({ ...form, completedSchool: e.target.value })}
                      placeholder="e.g. AL - ISRA Primary & Secondary School"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                {/* Manual: Place + DOB */}
                <div style={{ display: "flex", gap: 12 }}>
                  <Field label="Place of Birth (toos ah, la beddeli karaa)">
                    <input
                      value={form.placeOfBirth}
                      onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })}
                      placeholder="e.g. Muqdisho"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Date of Birth (toos ah, la beddeli karaa)">
                    <input
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      placeholder="e.g. 01/01/2008"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label="Date of Issue (gacanta)">
                  <input
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    placeholder="e.g. 01/07/2026"
                    style={inputStyle}
                  />
                </Field>

                {/* Auto-read from student record; can still be overridden manually */}
                <Field label="Student Photo (toos ah, waa la beddeli karaa)">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "#E5E7EB", border: "1px solid rgba(17,24,39,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10, color: "#9CA3AF" }}>No photo</span>}
                    </div>
                    <label style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                      {photo ? "Change Photo" : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </label>
                  </div>
                </Field>

                {/* AUTO: top 6 PASSED subjects by marks — read-only, single table (matches the template's one 6-row table) */}
                <div style={{ fontSize: 12.5, color: "#6B7280", fontWeight: 700, marginTop: 6 }}>
                  Maadooyinka (6) — si toos ah ayaa loo soo aqrinayaa (Fetch)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 70px", gap: 8, alignItems: "center" }}>
                  {subjects.map((s, i) => (
                    <div key={`subj-${i}`} style={{ display: "contents" }}>
                      <span style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>{i + 1}</span>
                      <input
                        value={s.name}
                        readOnly
                        placeholder={`Subject ${i + 1}`}
                        style={{ ...inputStyle, padding: "7px 10px", background: "#F3F4F6", color: "#374151", cursor: "not-allowed" }}
                      />
                      <input
                        value={s.marks}
                        readOnly
                        placeholder="Marks"
                        style={{ ...inputStyle, padding: "7px 10px", background: "#F3F4F6", color: "#374151", cursor: "not-allowed" }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, padding: "10px 12px", borderRadius: 10, background: "#EFFBF3", border: "1px solid rgba(22,101,52,0.15)" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>Result Average (auto)</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>
                    {resultAverage === "" ? "—" : `${resultAverage}%`}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={saving || uploadingPhoto}
                style={{ marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: saving ? "#9CA3AF" : "linear-gradient(90deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer" }}
              >
                {uploadingPhoto ? "Uploading photo…" : saving ? "Saving…" : "Generate Certificate"}
              </button>

              {previewCert && (
                <>
                  <button onClick={() => downloadCertificateImage(previewCert.fullName)} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    ⬇️ Download Certificate Image
                  </button>
                  <button onClick={() => downloadCertificatePdf(previewCert.fullName)} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                    📄 Download PDF
                  </button>
                  <button onClick={() => printCertificate("certificate-render-card")} style={{ marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
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
                <CertificateCard
                  certificate={{
                    fullName: form.fullName,
                    motherName: form.motherName,
                    placeOfBirth: form.placeOfBirth,
                    dateOfBirth: form.dateOfBirth,
                    completedSchool: form.completedSchool,
                    year: form.year,
                    rollNumber: form.rollNumber,
                    resultAverage,
                    subjects,
                    studentPhoto: photo,
                    issueDate: form.issueDate,
                  }}
                  elementId="certificate-render-card"
                />
              </div>
            </div>
          </div>

          {/* Issued list */}
          <div style={{ background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 4px 18px rgba(17,24,39,0.06)", border: "1px solid rgba(17,24,39,0.05)", marginTop: 22, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                Issued Certificates ({filteredCertificates.length})
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or Roll Number…" style={{ ...inputStyle, width: 260 }} />
            </div>
            {loading ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
            ) : filteredCertificates.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No certificates issued yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Photo</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Student</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Year</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Roll No</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Average</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}>Issued</th>
                    <th style={{ fontWeight: 600, paddingBottom: 8 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map((c) => (
                    <tr key={c.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 0" }}>
                        <StudentAvatar photo={c.studentPhoto} name={c.fullName} size={36} />
                      </td>
                      <td style={{ padding: "10px 0", color: "#111827", fontWeight: 600 }}>{c.fullName}</td>
                      <td style={{ color: "#6B7280" }}>{c.year}</td>
                      <td style={{ color: "#6B7280", fontFamily: "monospace" }}>{c.rollNumber || c.id}</td>
                      <td style={{ color: "#6B7280" }}>{c.resultAverage !== "" && c.resultAverage != null ? `${c.resultAverage}%` : "—"}</td>
                      <td style={{ color: "#6B7280" }}>{formatDate(c.createdAt)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setViewCert(c)} style={smallBtnStyle}>View</button>
                          <button onClick={() => handleDelete(c)} style={{ ...smallBtnStyle, color: "#DC2626", borderColor: "rgba(220,38,38,0.3)" }}>Delete</button>
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

      {/* View modal */}
      {viewCert && (
        <div onClick={() => setViewCert(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "28px 16px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(1120px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#111827" }}>{viewCert.fullName} — Certificate</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => downloadCertificateImage(viewCert.fullName, "certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>⬇️ Download</button>
                <button onClick={() => downloadCertificatePdf(viewCert.fullName, "certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>📄 PDF</button>
                <button onClick={() => printCertificate("certificate-view-modal-card")} style={{ padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${GREEN}`, background: "#fff", color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>🖨️ Print</button>
                <button onClick={() => setViewCert(null)} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(17,24,39,0.15)", background: "#fff", color: "#6B7280", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>✕ Close</button>
              </div>
            </div>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <CertificateCard certificate={viewCert} elementId="certificate-view-modal-card" />
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

function StudentAvatar({ photo, name, size = 26 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.4, fontWeight: 700, color: "#6B7280" }}>
      {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").charAt(0).toUpperCase()}
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