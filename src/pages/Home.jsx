// src/pages/Home.jsx
import "../styles/home.css";
import logo from "../assets/logo.png";
import galleryPhoto from "../admin/assets/student.png";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { collection, getCountFromServer, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase/firebase";
import {
  Users,
  Users2,
  DollarSign,
  BookOpen,
  Award,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Trophy,
  User,
  ArrowRight,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ExternalLink,
  UploadCloud,
  Loader2,
} from "lucide-react";

const SUPPORT_WHATSAPP = "252615860629";
const SUPPORT_EMAIL = "alisraprimaryandsecondaryschool@gmail.com";
const SUPPORT_PHONE_DISPLAY = "+252 61 5860629";
const SUPPORT_LOCATION = "Mogadishu, Somalia";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Admissions", to: "/admissions" },
  { label: "Academics", to: "/academics" },
  { label: "Library", to: "/library" },
  { label: "Gallery", to: "/gallery" },
  { label: "News & Events", to: "/news" },
  { label: "Contact", to: "/contact" },
];

const FEATURE_STRIP = [
  {
    icon: GraduationCap,
    label: "Quality Education",
    desc: "Excellence in teaching & learning",
    color: "green",
  },
  {
    icon: ShieldCheck,
    label: "Safe Environment",
    desc: "Secure and caring school community",
    color: "yellow",
  },
  {
    icon: Award,
    label: "Experienced Staff",
    desc: "Qualified and dedicated teachers",
    color: "purple",
  },
  {
    icon: Users,
    label: "Student Focused",
    desc: "Developing every child's potential",
    color: "orange",
  },
  {
    icon: TrendingUp,
    label: "Modern Facilities",
    desc: "Advanced resources for learning",
    color: "blue",
  },
  {
    icon: Trophy,
    label: "Proven Results",
    desc: "Outstanding academic performance",
    color: "emerald",
  },
];

const PORTALS = [
  {
    key: "student",
    icon: GraduationCap,
    title: "Student Portal",
    desc: "Access your profile, materials, results and exam marks anytime.",
    to: "/student-login",
    color: "green",
    badge: "Students",
  },
  {
    key: "teacher",
    icon: Users2,
    title: "Teacher Portal",
    desc: "Manage classes, academic resources, exams and assignments.",
    to: "/teacher-login",
    color: "gold",
    badge: "Faculty",
  },
  {
    key: "parent",
    icon: User,
    title: "Parent Portal",
    desc: "Track your child's progress, attendance, and school updates.",
    to: "/parent-login",
    color: "purple",
    badge: "Parents",
  },
  {
    key: "cashier",
    icon: DollarSign,
    title: "Cashier Portal",
    desc: "Record payments, manage monthly fees and print receipts.",
    to: "/cashier-login",
    color: "orange",
    badge: "Finance",
  },
  {
    key: "admission",
    icon: Sparkles,
    title: "Online Admission",
    desc: "Apply online for new student admissions easily and quickly.",
    to: "/admissions",
    color: "teal",
    badge: "New Intake",
  },
];

const GALLERY_PREVIEW = [galleryPhoto, galleryPhoto, galleryPhoto, galleryPhoto, galleryPhoto];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [statsData, setStatsData] = useState({
    students: null,
    teachers: null,
    classes: null,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [studentsSnap, teachersSnap, classesSnap] = await Promise.all([
          getCountFromServer(collection(db, "students")),
          getCountFromServer(collection(db, "teachers")),
          getCountFromServer(collection(db, "classes")),
        ]);

        setStatsData({
          students: studentsSnap.data().count,
          teachers: teachersSnap.data().count,
          classes: classesSnap.data().count,
        });
      } catch (err) {
        console.error("Failed to load home stats:", err);
      }
    }

    loadStats();
  }, []);

  const [heroMedia, setHeroMedia] = useState(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState("");
  const heroFileInputRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "homepage"),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setHeroMedia(data?.mediaUrl ? data : null);
      },
      (err) => console.error("Failed to load homepage media:", err)
    );
    return () => unsub();
  }, []);

  async function handleHeroCutoutUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setHeroUploadError("");
    setHeroUploading(true);

    try {
      // Remove the background client-side so the subject appears to
      // stand directly on top of the hero gradient/school photo,
      // with no white box or rectangle around it.
      const { removeBackground } = await import("@imgly/background-removal");
      const cutoutBlob = await removeBackground(file);

      const storage = getStorage();
      const path = `homepage/hero-cutout-${Date.now()}.png`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, cutoutBlob, { contentType: "image/png" });
      const url = await getDownloadURL(fileRef);

      await setDoc(
        doc(db, "settings", "homepage"),
        { mediaUrl: url, mediaType: "image", cutout: true, updatedAt: Date.now() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to process/upload hero cutout image:", err);
      setHeroUploadError("Sawirka lama gelin karin. Isku day mar kale.");
    } finally {
      setHeroUploading(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const HERO_STATS = [
    {
      icon: GraduationCap,
      value: statsData.students != null ? `${statsData.students}+` : "…",
      label: "Students Enrolled",
    },
    {
      icon: Users2,
      value: statsData.teachers != null ? `${statsData.teachers}+` : "…",
      label: "Qualified Teachers",
    },
    {
      icon: BookOpen,
      value: statsData.classes != null ? `${statsData.classes}+` : "…",
      label: "Classes Offered",
    },
    { icon: Trophy, value: "98%", label: "Pass Rate" },
  ];

  const ABOUT_STATS = [
    { icon: "🎓", value: statsData.students != null ? `${statsData.students}+` : "800+", label: "Active Students" },
    { icon: "👥", value: statsData.teachers != null ? `${statsData.teachers}+` : "60+", label: "Expert Staff" },
    { icon: "🏫", value: statsData.classes != null ? `${statsData.classes}+` : "25+", label: "Modern Classrooms" },
    { icon: "🏆", value: "100%", label: "Pass Rate" },
  ];

  return (
    <div className="home">
      {/* ---------- Top Nav ---------- */}
      <header className="home-nav">
        <Link to="/" className="brand">
          <div className="brand-logo-glow">
            <img src={logo} className="brand-logo" alt="AL - ISRA School logo" />
          </div>
          <div className="brand-text">
            <span className="brand-name">AL - ISRA SCHOOL</span>
            <span className="brand-tagline">PRIMARY &amp; SECONDARY EDUCATION</span>
          </div>
        </Link>

        <nav className="home-nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={`home-nav-link ${l.to === "/" ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link to="/admin-login" className="login-portal-btn">
            <User size={16} /> Portal Access
          </Link>

          <div className="menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="nav-dots-btn"
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="dots-menu">
                <Link to="/admin-login" className="dots-menu-item">
                  👑 Admin Portal
                </Link>
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dots-menu-item"
                >
                  💬 WhatsApp Contact
                </a>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="dots-menu-item">
                  📧 Send Email
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero Banner ---------- */}
      <section className="hero-banner-section">
        <div className="hero-banner">
          <div className="hero-banner-inner">
            <div className="hero-badge">
              <Sparkles size={14} className="hero-badge-icon" />
              <span>Excellence in Somali &amp; Global Education</span>
            </div>
            <h1 className="hero-title">
              NURTURING MINDS,
              <br />
              <span className="hero-title-accent">BUILDING FUTURES</span>
            </h1>
            <p className="hero-lede">
              Empowering students through academic rigor, moral integrity, and modern innovation in a safe, caring, and inspiring learning environment.
            </p>

            <div className="hero-cta-row">
              <Link to="/admissions" className="hero-cta hero-cta-primary">
                Apply for Admission <ArrowRight size={16} />
              </Link>
              <Link to="/about" className="hero-cta hero-cta-secondary">
                Learn More <ExternalLink size={15} />
              </Link>
            </div>
          </div>

          <div className="hero-photo-box">
            {heroMedia?.mediaUrl ? (
              heroMedia.mediaType === "video" ? (
                <video
                  src={heroMedia.mediaUrl}
                  className="hero-photo-box-img"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={heroMedia.mediaUrl}
                  alt="AL - ISRA School"
                  className={`hero-photo-box-img ${heroMedia.cutout ? "hero-photo-box-img-cutout" : ""}`}
                />
              )
            ) : (
              <div className="hero-photo-box-placeholder">
                <div className="placeholder-content">
                  <Sparkles size={32} />
                  <span>AL - ISRA School Media Showcase</span>
                </div>
              </div>
            )}

            <input
              ref={heroFileInputRef}
              type="file"
              accept="image/*"
              className="hero-cutout-input"
              onChange={handleHeroCutoutUpload}
            />
            <button
              type="button"
              className="hero-cutout-upload-btn"
              onClick={() => heroFileInputRef.current?.click()}
              disabled={heroUploading}
              title="Soo geli sawir (background-ka waa la saarayaa)"
            >
              {heroUploading ? (
                <>
                  <Loader2 size={15} className="hero-cutout-spin" /> Waa la geliyaa...
                </>
              ) : (
                <>
                  <UploadCloud size={15} /> Beddel sawirka
                </>
              )}
            </button>
            {heroUploadError && <span className="hero-cutout-error">{heroUploadError}</span>}
          </div>
        </div>
      </section>

      {/* ---------- Feature Strip + Stats ---------- */}
      <section className="feature-stats-row">
        <div className="feature-strip-card">
          {FEATURE_STRIP.map((f) => {
            const Icon = f.icon;
            return (
              <div className="feature-item" key={f.label}>
                <span className={`feature-icon-circle feature-icon-${f.color}`}>
                  <Icon size={22} />
                </span>
                <div className="feature-text">
                  <span className="feature-item-label">{f.label}</span>
                  <span className="feature-item-desc">{f.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="stats-dark-card">
          <div className="stats-header">
            <h3>School At A Glance</h3>
            <p>Real-time metrics &amp; academic standing</p>
          </div>
          <div className="stats-grid-inner">
            {HERO_STATS.map((s) => {
              const Icon = s.icon;
              return (
                <div className="stat-mini-box" key={s.label}>
                  <div className="stat-icon-wrap">
                    <Icon size={20} />
                  </div>
                  <span className="stat-mini-value">{s.value}</span>
                  <span className="stat-mini-label">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Portals ---------- */}
      <section className="school-portals-section">
        <div className="section-title-wrap">
          <span className="section-subtitle">QUICK ACCESS</span>
          <h2 className="section-main-title">School Portals &amp; Digital Services</h2>
          <p className="section-desc">Select your portal below to log in to your custom administrative or learning dashboard.</p>
        </div>

        <div className="school-portals-row">
          <div className="portals-inline-grid">
            {PORTALS.map((p) => {
              const Icon = p.icon;
              return (
                <div className={`portal-box portal-${p.color}`} key={p.key}>
                  <div className="portal-top-bar">
                    <span className="portal-icon-circle">
                      <Icon size={26} />
                    </span>
                    <span className="portal-badge">{p.badge}</span>
                  </div>
                  <h3 className="portal-title">{p.title}</h3>
                  <p className="portal-desc">{p.desc}</p>
                  <Link to={p.to} className="portal-btn">
                    <span>{p.key === "admission" ? "Apply Now" : "Access Portal"}</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- About Our School ---------- */}
      <section className="about-section-wrap">
        <div className="about-preview-card">
          <div className="about-content-grid">
            <div className="about-text-column">
              <span className="section-subtitle">WHO WE ARE</span>
              <h2 className="about-preview-title">About AL - ISRA School</h2>
              <p className="about-preview-text">
                At AL - ISRA Primary &amp; Secondary School, we are dedicated to nurturing young minds through academic excellence, character building, and innovative digital learning. Our mission is to empower students with knowledge and strong values for a prosperous future.
              </p>
              
              <ul className="about-highlights-list">
                <li><CheckCircle2 size={18} /> Accredited Curriculum &amp; STEM Learning</li>
                <li><CheckCircle2 size={18} /> Highly Qualified &amp; Dedicated Teachers</li>
                <li><CheckCircle2 size={18} /> Modern Digital Student Tracking</li>
              </ul>

              <Link to="/about" className="view-more-btn">
                Discover More About Us <ArrowRight size={16} />
              </Link>
            </div>

            <div className="about-stats-column">
              <div className="about-stats-grid">
                {ABOUT_STATS.map((s) => (
                  <div className="about-stat-box" key={s.label}>
                    <span className="about-stat-icon">{s.icon}</span>
                    <span className="about-stat-value">{s.value}</span>
                    <span className="about-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gallery-section-divider">
            <h3 className="gallery-preview-title">Life At AL - ISRA</h3>
            <div className="gallery-preview-grid">
              {GALLERY_PREVIEW.map((img, i) => (
                <div key={i} className="gallery-img-wrapper">
                  <img src={img} alt="School Activity" className="gallery-preview-img" />
                </div>
              ))}
            </div>
            <div className="gallery-footer-action">
              <Link to="/gallery" className="gallery-link-btn">
                View Photo Gallery <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="home-footer">
        <div className="footer-container">
          <div className="home-footer-left">
            <img src={logo} className="footer-logo" alt="AL - ISRA School logo" />
            <div className="footer-brand-text">
              <div className="footer-school-name">AL - ISRA SCHOOL</div>
              <div className="footer-school-tagline">
                PRIMARY &amp; SECONDARY EDUCATION
              </div>
            </div>
          </div>

          <div className="home-footer-contact">
            <a href={`tel:${SUPPORT_PHONE_DISPLAY.replace(/\s/g, "")}`}>
              <Phone size={15} /> {SUPPORT_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail size={15} /> {SUPPORT_EMAIL}
            </a>
            <span>
              <MapPin size={15} /> {SUPPORT_LOCATION}
            </span>
          </div>

          <div className="home-footer-quote">
            “Excellence in Education, Bright Future for Every Child.”
          </div>
        </div>
        <div className="footer-bottom-bar">
          <p>&copy; {new Date().getFullYear()} AL - ISRA School. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}