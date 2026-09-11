// src/pages/About.jsx
import "../styles/about.css";
import logo from "../assets/logo.png";
import heroPhoto from "../admin/assets/hero-students.jpg";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";

const SUPPORT_WHATSAPP = "252617390261";
const SUPPORT_EMAIL = "alisraprimaryandsecondaryschool@gmail.com";
const SUPPORT_PHONE_DISPLAY = "+252 61 5860629";
const SUPPORT_LOCATION = "Mogadishu, Somalia";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const CORE_VALUES = [
  { icon: "📖", title: "Academic Excellence", desc: "A challenging, well-rounded curriculum that prepares students for national exams and beyond." },
  { icon: "🤝", title: "Character & Integrity", desc: "We build honest, disciplined and respectful young people, not just good test-takers." },
  { icon: "🛡️", title: "Safe Environment", desc: "A secure, caring campus where every child feels protected and free to learn." },
  { icon: "🌍", title: "Global Citizenship", desc: "Preparing students to lead and contribute both locally and on the world stage." },
];

const MISSION_PILLARS = [
  {
    icon: "🏅",
    title: "Excellence in Teaching",
    desc: "Delivering a comprehensive curriculum that blends modern educational methodologies with foundational values to foster critical thinking and lifelong learning.",
  },
  {
    icon: "🌱",
    title: "Holistic Development",
    desc: "Nurturing students' moral, social, and intellectual growth, preparing them to become responsible, ethical, and capable leaders.",
  },
  {
    icon: "🚀",
    title: "Innovation & Future-Readiness",
    desc: "Integrating modern tools, scientific inquiry, and technological literacy to ensure students are fully prepared for higher education and the demands of the modern global workforce.",
  },
];

const HISTORY_TIMELINE = [
  { year: "2014", text: "AL - ISRA Primary & Secondary School was founded in Mogadishu with a mission to raise the next generation of leaders." },
  { year: "2015", text: "Welcomed our first full cohort of students and hired additional qualified teaching staff." },
  { year: "2016", text: "Introduced a structured curriculum and set up our first dedicated classrooms for primary grades." },
  { year: "2017", text: "Expanded classrooms and introduced a dedicated science and computer lab for hands-on learning." },
  { year: "2018", text: "Opened enrollment for secondary grades, extending our academic program beyond primary school." },
  { year: "2019", text: "Strengthened extracurricular activities and introduced regular exams and progress reporting for parents." },
  { year: "2020", text: "Grew into a full primary and secondary campus, welcoming hundreds of new students across Mogadishu." },
  { year: "2021", text: "Renovated and expanded school facilities to keep pace with our growing student body." },
  { year: "2022", text: "Invested in teacher training and professional development to raise academic standards further." },
  { year: "2023", text: "Strengthened our academic programs and teaching staff, marking a decade of steady, disciplined growth." },
  { year: "2024", text: "Upgraded our administrative systems and expanded support services for students and parents." },
  { year: "2025", text: "Launched our digital school management system, connecting students, teachers, parents and staff." },
  { year: "2026", text: "Continuing to grow — new facilities, more teachers, and an even stronger academic program." },
];

const LEADERSHIP = [
  { name: "Headmaster's Office", role: "School Administration", icon: "🎓" },
  { name: "Academic Committee", role: "Curriculum & Standards", icon: "📚" },
  { name: "Discipline Committee", role: "Student Welfare & Conduct", icon: "🛡️" },
];

const STATS = [
  { icon: "🎓", value: "800+", label: "Students" },
  { icon: "👥", value: "60+", label: "Teachers" },
  { icon: "🏫", value: "25+", label: "Classrooms" },
  { icon: "🏆", value: "100%", label: "Pass Rate" },
];

const HERO_LEDE =
  "Since 2014, AL - ISRA Primary & Secondary School has been committed to academic excellence, character building and innovative learning — preparing every child to become a responsible global citizen and future leader.";

// Types the given text out one character at a time, once, starting after
// `startDelay` ms. Used once for the hero lede — the single deliberate
// "written by hand" moment on this page, not repeated elsewhere.
function TypewriterText({ text, startDelay = 0, speed = 18, className }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let timer;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(timer);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(timer);
    };
  }, [text, startDelay, speed]);

  return (
    <p className={className}>
      {shown}
      {!done && <span className="typewriter-cursor">&nbsp;</span>}
    </p>
  );
}

// Fades a whole section up once, the first time it enters the viewport.
// Applied per-section (not per-card) — one quiet reveal, not a cascade.
function RevealSection({ as: Tag = "section", className = "", children, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal-section${visible ? " is-visible" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);
  const helpRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Xannib: F12, right-click, iyo shortcut-yada developer tools ----
  useEffect(() => {
    function handleContextMenu(e) {
      e.preventDefault();
    }

    function handleKeyDown(e) {
      const key = (e.key || "").toLowerCase();

      if (key === "f12") {
        e.preventDefault();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === "i" || key === "j" || key === "c")
      ) {
        e.preventDefault();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s")) {
        e.preventDefault();
        return;
      }
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // ---- Timeline: the connecting line fills as each year scrolls past
  // the middle of the viewport — the one scroll-driven moment on the page.
  const timelineItemRefs = useRef([]);
  const [pastCount, setPastCount] = useState(0);

  const setTimelineRef = useCallback((el, i) => {
    timelineItemRefs.current[i] = el;
  }, []);

  useEffect(() => {
    const items = timelineItemRefs.current.filter(Boolean);
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.dataset.idx);
          if (entry.isIntersecting) {
            setPastCount((prev) => Math.max(prev, idx + 1));
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const fillPercent = HISTORY_TIMELINE.length
    ? Math.round((pastCount / HISTORY_TIMELINE.length) * 100)
    : 0;

  return (
    <div className="about-page">
      {/* ---------- Top Nav ---------- */}
      <header className="home-nav">
        <Link to="/" className="brand">
          <img src={logo} className="brand-logo" alt="AL - ISRA School logo" />
          <div className="brand-text">
            <span className="brand-name">AL - ISRA SCHOOL</span>
            <span className="brand-tagline">AL - ISRA PRIMARY &amp; SECONDARY SCHOOL</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`home-nav-link${l.to === "/about" ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="menu-wrap" ref={helpRef}>
            <button
              type="button"
              className="help-pill-hidden"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="Need help?"
            >
              ?
            </button>

            {helpOpen && (
              <div className="dots-menu help-menu">
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dots-menu-item"
                >
                  💬 WhatsApp: 0{SUPPORT_WHATSAPP.slice(3)}
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="dots-menu-item">
                  📧 {SUPPORT_EMAIL}
                </a>
              </div>
            )}
          </div>

          <div className="menu-wrap" ref={menuRef}>
            <Link to="/admin-login" className="login-portal-btn">
              <span className="login-portal-icon">👤</span>
              Login / Portal
            </Link>

            <button
              type="button"
              className="dots-btn-hidden"
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="dots-menu">
                <Link to="/admin-login" className="dots-menu-item">
                  👑 Admin Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- About Hero ---------- */}
      <section className="about-hero">
        <div className="about-hero-copy">
          <span className="about-eyebrow">
            <span className="about-eyebrow-star">★</span>&nbsp;About AL - ISRA School
          </span>

          <h1 className="about-hero-title">
            <span className="about-hero-title-line">
              <span>Nurturing minds,</span>
            </span>
            <span className="about-hero-title-line">
              <span>building futures.</span>
            </span>
          </h1>

          <TypewriterText text={HERO_LEDE} startDelay={950} speed={14} className="about-hero-lede" />

          <div className="about-hero-actions">
            <Link to="/admissions" className="hero-cta hero-cta-primary">
              Apply for Admission <span>➜</span>
            </Link>
            <Link to="/contact" className="hero-cta hero-cta-secondary">
              Contact Us <span>➜</span>
            </Link>
          </div>

          <div className="about-stats-row">
            {STATS.map((s) => (
              <div className="about-stat" key={s.label}>
                <div className="about-stat-value">{s.value}</div>
                <div className="about-stat-label">
                  {s.icon} {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="about-hero-visual">
          <div className="about-hero-photo-frame">
            <img src={heroPhoto} alt="AL - ISRA School students" />
          </div>
          <div className="about-hero-tag">Since 2014 — raising Mogadishu's next generation of leaders.</div>
        </div>
      </section>

      {/* ---------- Mission / Vision / Photo ---------- */}
      <RevealSection className="about-mission-grid">
        <div className="about-mission-photo-wrap">
          <img src={heroPhoto} alt="AL - ISRA School students" className="about-mission-photo" />
        </div>

        <div className="about-mission-cards">
          <div className="about-mission-card">
            <span className="about-mission-card-icon">🔭</span>
            <h3>Our Vision</h3>
            <p>
              To be a leading, world-class educational institution in Mogadishu,
              Somalia, recognized for academic excellence, innovation, and holistic
              development in primary and secondary education, empowering
              generations of students to master languages, advance in sciences,
              and drive positive transformation in their communities and the
              global society.
            </p>
          </div>
          <div className="about-mission-card">
            <span className="about-mission-card-icon">🎯</span>
            <h3>Our Mission</h3>
            <p>
              To cultivate an inspiring, rigorous, and supportive learning
              environment that equips students with exceptional academic
              foundations, advanced linguistic capabilities, and essential
              scientific knowledge.
            </p>
          </div>
        </div>
      </RevealSection>

      {/* ---------- Mission Pillars ---------- */}
      <RevealSection className="about-section about-section-alt">
        <div className="about-section-head">
          <h2 className="about-section-title">How we deliver our mission</h2>
          <p className="about-section-sub">
            Three pillars that shape every classroom, every lesson, and every student at AL - ISRA School.
          </p>
        </div>

        <div className="mission-pillars-list">
          {MISSION_PILLARS.map((p) => (
            <div className="mission-pillar-row" key={p.title}>
              <span className="mission-pillar-icon">{p.icon}</span>
              <div>
                <h3 className="mission-pillar-title">{p.title}</h3>
                <p className="mission-pillar-desc">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ---------- Core Values ---------- */}
      <RevealSection className="about-section">
        <div className="about-section-head">
          <h2 className="about-section-title">What we stand for</h2>
          <p className="about-section-sub">The values that guide everything we do at AL - ISRA School.</p>
        </div>

        <div className="core-values-list">
          {CORE_VALUES.map((v) => (
            <div className="core-value-row" key={v.title}>
              <div className="core-value-copy">
                <span className="core-value-icon">{v.icon}</span>
                <h3 className="core-value-title">{v.title}</h3>
                <p className="core-value-desc">{v.desc}</p>
              </div>
              <div />
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ---------- History Timeline ---------- */}
      <RevealSection className="about-section about-section-alt">
        <div className="about-section-head">
          <h2 className="about-section-title">Our journey</h2>
          <p className="about-section-sub">From our founding to today — a growing story of learning and leadership.</p>
        </div>

        <div className="timeline">
          <div className="timeline-track">
            <div className="timeline-track-fill" style={{ height: `${fillPercent}%` }} />
          </div>
          {HISTORY_TIMELINE.map((t, i) => (
            <div
              className={`timeline-item${i < pastCount ? " is-past" : ""}`}
              key={t.year}
              data-idx={i}
              ref={(el) => setTimelineRef(el, i)}
            >
              <div className="timeline-dot" />
              <div className="timeline-year">{t.year}</div>
              <div className="timeline-text">{t.text}</div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ---------- Leadership ---------- */}
      <RevealSection className="about-section">
        <div className="about-section-head">
          <h2 className="about-section-title">School leadership</h2>
          <p className="about-section-sub">Guiding AL - ISRA School with care, discipline and vision.</p>
        </div>

        <div className="leadership-row">
          {LEADERSHIP.map((l) => (
            <div className="leadership-card" key={l.name}>
              <span className="leadership-icon">{l.icon}</span>
              <h3 className="leadership-name">{l.name}</h3>
              <p className="leadership-role">{l.role}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* ---------- CTA ---------- */}
      <section className="about-cta">
        <h2 className="about-cta-title">Ready to join AL - ISRA School?</h2>
        <p className="about-cta-text">
          Give your child the foundation they deserve. Admissions are open now.
        </p>
        <div className="about-cta-row">
          <Link to="/admissions" className="hero-cta hero-cta-primary">
            Apply for Admission <span>➜</span>
          </Link>
          <Link to="/contact" className="hero-cta hero-cta-secondary">
            Contact Us <span>➜</span>
          </Link>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="home-footer">
        <div className="home-footer-left">
          <img src={logo} className="footer-logo" alt="AL - ISRA School logo" />
          <div>
            <div className="footer-school-name">AL - ISRA SCHOOL</div>
            <div className="footer-school-tagline">
              AL - ISRA PRIMARY &amp; SECONDARY SCHOOL
            </div>
          </div>
        </div>

        <div className="home-footer-contact">
          <a href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}>
            📞 {SUPPORT_PHONE_DISPLAY}
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>✉️ {SUPPORT_EMAIL}</a>
          <span>📍 {SUPPORT_LOCATION}</span>
        </div>

        <div className="home-footer-quote">
          "Excellence in Education, Bright Future for Every Child."
        </div>
      </footer>
    </div>
  );
}