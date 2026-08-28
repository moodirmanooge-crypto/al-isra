// src/teacher/MobileBottomNav.jsx
// Bottom tab bar shown ONLY on mobile widths (<= 900px), matching the
// student-portal pattern: Overview / ID Card / Attendance / Timetable /
// Results / Messages / Profile, each with an icon + label, active tab
// highlighted.

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  IdCard,
  CalendarCheck2,
  BarChart3,
  Mail,
  User,
  CalendarDays,
} from "lucide-react";
import { useMessages } from "../context/MessagesContext"; // Hubi path-kan

const tabs = [
  { name: "Overview", icon: LayoutDashboard, path: "/teacher/dashboard" },
  { name: "ID Card", icon: IdCard, path: "/teacher/id-card" },
  { name: "Attendance", icon: CalendarCheck2, path: "/teacher/attendance" },
  { name: "Timetable", icon: CalendarDays, path: "/teacher/timetable" },
  { name: "Results", icon: BarChart3, path: "/teacher/results" },
  { name: "Messages", icon: Mail, path: "/teacher/messages" },
  { name: "Profile", icon: User, path: "/teacher/profile" },
];

function MobileBottomNavStyles() {
  return (
    <style>{`
      .tmb-nav { display: none; }

      @media (max-width: 900px) {
        .tmb-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 70;
          background: #0B1120;
          border-top: 1px solid rgba(255,255,255,.08);
          padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
          justify-content: space-between;
        }
        .tmb-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 2px;
          text-decoration: none;
          color: #64748B;
          font-size: 10.5px;
          font-weight: 600;
          position: relative;
          min-width: 0;
        }
        .tmb-item span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .tmb-item.active { color: #22C55E; }
        .tmb-badge {
          position: absolute;
          top: 0;
          right: 14%;
          background: #EF4444;
          color: #fff;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 700;
          padding: 1px 5px;
          min-width: 15px;
          text-align: center;
        }
        /* leave room at the bottom of scrollable page content so the
           fixed bar never covers the last bit of content */
        .tmb-page-padding { padding-bottom: 78px !important; }
      }
    `}</style>
  );
}

export default function MobileBottomNav() {
  const { unreadCount } = useMessages();

  return (
    <>
      <MobileBottomNavStyles />
      <nav className="tmb-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isMessages = t.path === "/teacher/messages";
          return (
            <NavLink
              key={t.path}
              to={t.path}
              className={({ isActive }) => `tmb-item${isActive ? " active" : ""}`}
            >
              <div style={{ position: "relative" }}>
                <Icon size={20} />
                {isMessages && unreadCount > 0 && (
                  <span className="tmb-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </div>
              <span>{t.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}