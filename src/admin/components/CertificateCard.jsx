// src/admin/components/CertificateCard.jsx
// Renders a Class Leaving Certificate using the EXACT printed template
// artwork (certificate-template.png) as the background, with the
// student's data overlaid on top at the correct positions.
//
// COORDINATES BELOW WERE RE-MEASURED DIRECTLY AGAINST THE ACTUAL
// certificate-template.png FILE (1491 x 1055 px) using pixel-level
// underline/divider detection (not eyeballed) — this fixes a previous
// version where every text field was rendering ~5-9% too high (which is
// why "AL - ISRA School" used to appear overlapping the name line).
//
// IMPORTANT — what the REAL template actually has (confirmed by direct
// pixel inspection, not assumed):
//  - Somali (left) side has ONLY 4 data lines: Full Name, Date of Birth,
//    Place of Birth, Year. There is NO Somali "Mother's Name" line.
//  - English (right) side has 6 data lines: Student's Name, Place &
//    Date of Birth (ONE combined line), Completed Secondary School,
//    Year, Roll Number (Year + Roll Number share one line, two blanks),
//    Result Average.
//  - The subjects table is a SINGLE 6-row table (No / Maadada-Subject /
//    Notada-Marks) — NOT four separate Somali/English tables. Row
//    numbers 1-6 are already printed on the template image itself.
//  - There is NO printed "Date of Issue" line anywhere on this template,
//    and NO "Mother's Name" line on either side — so neither is
//    rendered here (rendering text with no real destination is exactly
//    what caused the earlier misplaced-text bug).
//
// Layout: LEFT half = Somali fields, RIGHT half = English fields (both
// halves share the same student data — same names, same 6 subjects —
// just at their own template positions).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import certificateTemplate from "./assets/certificate-template.png";

const CARD_W = 900;
const RATIO = 1055 / 1491; // matches the real template.png aspect ratio

const DEFAULT_SCHOOL_NAME = "AL - ISRA Primary & Secondary School";

// Font sizes — per-field, tuned to match the real printed certificate's
// proportions (wider fields get smaller text so they never overflow).
const FONT = {
  name: 14,
  dob: 11,
  school: 9,
  year: 12,
  roll: 12,
  result: 12,
  subject: 9.5,
  marks: 9.5,
};
const FONT_WEIGHT = 600;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";

// Sawirka ardayga (photo box) — dhexda labada dhinac
const PHOTO_BOX = { left: 44.0, top: 34.5, width: 10.5, height: 16.6 };

// Goobaha qoraalada Soomaaliga (Somali Fields) — DHINACA BIDIX (left half).
// Only 4 real lines exist on the template — no motherName here.
const FIELD_SOMALI = {
  fullName: { top: 46.92, left: 16.5, right: 58.2 },
  dateOfBirth: { top: 49.67, left: 20.2, right: 58.2 },
  placeOfBirth: { top: 52.32, left: 18.0, right: 66.2 },
  year: { top: 55.07, left: 17.3, right: 58.2 },
};

// Goobaha qoraalada Ingiriiska (English Fields) — DHINACA MIDIG (right half)
const FIELD = {
  fullName: { top: 46.82, left: 68.5, right: 4.8 },
  placeDob: { top: 49.38, left: 72.0, right: 4.8 },
  schoolName: { top: 52.04, left: 76.2, right: 4.9 },
  year: { top: 54.55, left: 62.0, right: 25.9 },
  rollNumber: { top: 54.55, left: 83.2, right: 4.8 },
  resultAverage: { top: 57.16, left: 68.1, right: 15.7 },
};

// Single subjects table — 6 rows, one Subject column + one Marks column.
// Row numbers (1-6) are already printed on the template; we only fill
// the Subject and Marks cells alongside them.
const ROW_TOPS = [67.68, 70.52, 73.32, 76.07, 78.86, 81.65];
const TABLE_COLS = {
  subjectLeft: 32.0,
  subjectRight: 100 - 58.3, // = 41.7
  marksLeft: 60.0,
  marksRight: 100 - 74.3, // = 25.7
};

export default function CertificateCard({ certificate, verifyUrl, elementId }) {
  const {
    fullName,
    placeOfBirth,
    dateOfBirth,
    year,
    rollNumber,
    resultAverage,
    completedSchool,
    // The 6 auto-read (passed) subjects, single table. Falls back to
    // `subjectsEnglish` so certificates saved before this fix (which
    // used the old dual-table format) still display their data.
    subjects,
    subjectsEnglish,
    studentPhoto,
  } = certificate || {};

  const schoolName = (completedSchool || "").trim() || DEFAULT_SCHOOL_NAME;
  const placeDobText = [placeOfBirth, dateOfBirth].filter(Boolean).join(" - ");

  const tableSubjects =
    subjects && subjects.length ? subjects : (subjectsEnglish || []).slice(0, 6);

  const qrSrc = verifyUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
        verifyUrl
      )}`
    : "";

  return (
    <div
      id={elementId}
      style={{
        position: "relative",
        width: CARD_W,
        height: CARD_W * RATIO,
        backgroundImage: `url(${certificateTemplate})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        borderRadius: 6,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: FONT_FAMILY,
        flexShrink: 0,
      }}
    >
      {/* Student photo — centered inside the dashed photo box */}
      <div
        style={{
          position: "absolute",
          left: `${PHOTO_BOX.left}%`,
          top: `${PHOTO_BOX.top}%`,
          width: `${PHOTO_BOX.width}%`,
          height: `${PHOTO_BOX.height}%`,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {studentPhoto ? (
          <img
            src={studentPhoto}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>

      {/* Somali column (left half) — 4 fields only */}
      <FitText text={fullName} {...FIELD_SOMALI.fullName} maxFontPx={FONT.name} />
      <FitText text={dateOfBirth} {...FIELD_SOMALI.dateOfBirth} maxFontPx={FONT.dob} />
      <FitText text={placeOfBirth} {...FIELD_SOMALI.placeOfBirth} maxFontPx={FONT.dob} />
      <FitText text={year} {...FIELD_SOMALI.year} maxFontPx={FONT.year} />

      {/* English column (right half) — 6 fields */}
      <FitText text={fullName} {...FIELD.fullName} maxFontPx={FONT.name} />
      <FitText text={placeDobText} {...FIELD.placeDob} maxFontPx={FONT.dob} />
      <FitText text={schoolName} {...FIELD.schoolName} maxFontPx={FONT.school} />
      <FitText text={year} {...FIELD.year} maxFontPx={FONT.year} />
      <FitText text={rollNumber} {...FIELD.rollNumber} maxFontPx={FONT.roll} />
      <FitText
        text={resultAverage !== "" && resultAverage != null ? `${resultAverage}%` : ""}
        {...FIELD.resultAverage}
        maxFontPx={FONT.result}
      />

      {/* Subjects table — ONE table, 6 rows (No column already printed) */}
      {tableSubjects.slice(0, 6).map((s, i) => (
        <div key={`subj-${i}`}>
          <FitText
            text={s?.name}
            top={ROW_TOPS[i]}
            left={TABLE_COLS.subjectLeft}
            right={TABLE_COLS.subjectRight}
            maxFontPx={FONT.subject}
            align="left"
          />
          <FitText
            text={s?.marks}
            top={ROW_TOPS[i]}
            left={TABLE_COLS.marksLeft}
            right={TABLE_COLS.marksRight}
            maxFontPx={FONT.marks}
            align="center"
          />
        </div>
      ))}

      {/* QR code */}
      {qrSrc && (
        <div
          style={{
            position: "absolute",
            right: "2.5%",
            bottom: "3.5%",
            width: "6.5%",
            aspectRatio: "1 / 1",
            background: "#ffffff",
            border: "1px solid #000000",
            padding: 2,
            boxSizing: "border-box",
          }}
        >
          <img src={qrSrc} alt="QR code" style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      )}
    </div>
  );
}

// FitText: dul dhigaya qoraalka xariiqda (underline) sawirka, isaga oo
// automatic-ka u yareeya font-size-ka haddii qoraalku aad u dheer yahay
// si aanu uga baxsan goobtiisa.
function FitText({ text, top, left, right, maxFontPx, minFontPx, align = "left" }) {
  const boxRef = useRef(null);
  const spanRef = useRef(null);
  const min = minFontPx || maxFontPx * 0.5;
  const [fontPx, setFontPx] = useState(maxFontPx);

  useLayoutEffect(() => {
    setFontPx(maxFontPx);
  }, [text, maxFontPx]);

  useEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;
    let size = maxFontPx;
    span.style.fontSize = `${size}px`;
    let guard = 0;
    while (span.scrollWidth > box.clientWidth && size > min && guard < 60) {
      size -= 0.5;
      span.style.fontSize = `${size}px`;
      guard += 1;
    }
    setFontPx(size);
  }, [text, maxFontPx, min]);

  if (!text) return null;

  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top: `${top - 2.5}%`,
        height: "2.8%",
        left: `${left}%`,
        right: `${right}%`,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "flex-end",
        overflow: "hidden",
      }}
    >
      <span
        ref={spanRef}
        style={{
          whiteSpace: "nowrap",
          fontSize: fontPx,
          fontFamily: FONT_FAMILY,
          fontWeight: FONT_WEIGHT,
          letterSpacing: "0px",
          color: "#111111",
          lineHeight: 1,
          transform: "translateY(-0.5px)",
        }}
      >
        {text}
      </span>
    </div>
  );
}