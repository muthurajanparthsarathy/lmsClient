"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { showErrorToast } from "@/components/ui/toastUtils";
import { isPocSession, isPocRoleValue, isPocRoute, POC_HOME } from "@/lib/session";
// Same route map the sidebar links from, so the post-login landing page can
// never point at a folder that does not exist (POC Dashboard, Feedback).
import { routeForPermissionKey } from "@/app/lms/shared/navRoutes";

interface Permission {
  permissionName: string;
  permissionKey: string;
  permissionFunctionality: any[];
  icon: string;
  color: string;
  description: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  _id: string;
}

interface LoginResponse {
  message: Array<{ key: string; value: string }>;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    role: {
      $oid?: string;
      _id?: string;
      originalRole?: string;
      renameRole?: string;
      roleValue?: string;
      [key: string]: any;
    } | string;
    firstTimeLoginDone: boolean;
    permissions?: Permission[];
    [key: string]: any;
  };
  token: string;
  institution: string;
  institutionName: string;
  userId: string;
  basedOn: string;
}

interface FormErrors {
  email: string;
  password: string;
}

// ── Client-info helpers (used to capture login metadata) ─────────────────────
const getBrowserName = (ua: string): string => {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR|Opera/.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  return 'Browser';
};

const getOSName = (ua: string): string => {
  if (/Windows NT 10\.0|Windows NT 11/.test(ua)) return 'Windows 10/11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
};

const getDeviceType = (ua: string): string => {
  if (/iPad/.test(ua)) return 'Tablet';
  if (/Android.*Mobile|iPhone|Windows Phone|Mobile/.test(ua)) return 'Mobile';
  return 'Desktop PC';
};

const CAROUSEL_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=1000&fit=crop&crop=faces",
    alt: "Students collaborating on a project",
  },
  {
    src: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=1000&fit=crop&crop=faces",
    alt: "Student studying with laptop",
  },
  {
    src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=1000&fit=crop&crop=faces",
    alt: "Group learning session",
  },
];

const SmartCliffLogin = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({ email: "", password: "" });

  const [activeSlide, setActiveSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || index === activeSlide) return;
      setIsTransitioning(true);
      setActiveSlide(index);
      setTimeout(() => setIsTransitioning(false), 600);
    },
    [activeSlide, isTransitioning]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const getRedirectParam = (): string => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("redirect") || "";
  };

  const clearAuthData = () => {
    const keys = [
      "smartcliff_token", "smartcliff_institution", "smartcliff_institutionname",
      "smartcliff_basedOn", "smartcliff_userId", "smartcliff_userData",
      "smartcliff_role", "smartcliff_roleId", "smartcliff_roleValue",
      "smartcliff_originalRole", "smartcliff_renameRole",
      "smartcliff_firstPermissionKey", "smartcliff_permissions",
    ];
    keys.forEach((k) => localStorage.removeItem(k));
  };

  useEffect(() => {
    setMounted(true);
    const existingToken = localStorage.getItem("smartcliff_token");
    const existingInstitution = localStorage.getItem("smartcliff_institution");
    const existingBasedOn = localStorage.getItem("smartcliff_basedOn");

    if (existingToken && existingInstitution && existingBasedOn) {
      const redirectTo = getRedirectParam();
      // A POC may only follow a ?redirect= that points into its own console;
      // anything else would land on a route the gate refuses.
      if (isPocSession()) {
        toast.info("Welcome back!");
        window.location.href = redirectTo && isPocRoute(redirectTo) ? redirectTo : POC_HOME;
        return;
      }
      if (redirectTo) { toast.info("Welcome back!"); window.location.href = redirectTo; return; }
      let redirectPath = "/lms/pages/admindashboard";
      const firstPermissionKey = localStorage.getItem("smartcliff_firstPermissionKey");
      const existingRole = localStorage.getItem("smartcliff_role");
      const existingRoleValue = localStorage.getItem("smartcliff_roleValue");
      const originalRole = localStorage.getItem("smartcliff_originalRole");
      if (firstPermissionKey) {
        redirectPath = routeForPermissionKey(firstPermissionKey);
      } else if (existingRole && existingRoleValue) {
        const userRole = originalRole?.toLowerCase() || existingRoleValue?.toLowerCase() || existingRole?.toLowerCase() || "";
        if (userRole === "student" || userRole.includes("student")) redirectPath = "/lms/pages/studentdashboard";
      }
      toast.info("Welcome back!");
      router.push(redirectPath);
    }
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      // Collect synchronous client info (no delay)
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const clientInfo: Record<string, string> = {
        browser: getBrowserName(ua),
        os: getOSName(ua),
        device: getDeviceType(ua),
        userAgent: ua,
      };
      // Best-effort public IP + location BEFORE login, so the real IP is stored
      // at login time (a post-login fetch would be aborted by the redirect).
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 2500);
        const geo = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
        clearTimeout(tid);
        if (geo.ok) {
          const d = await geo.json();
          if (d.ip) clientInfo.ipAddress = String(d.ip);
          const loc = [d.city, d.region, d.country_name].filter(Boolean).join(', ');
          if (loc) clientInfo.location = loc;
        }
      } catch { /* best effort — login is never blocked beyond the timeout */ }
      const response = await fetch("https://lmsserver-yeve.onrender.com/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, clientInfo }),
      });
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message?.[0]?.value || "Login failed"); }
      const result = await response.json();
      (result as any)._clientInfo = clientInfo;
      return result as LoginResponse;
    },
    onSuccess: async (data: LoginResponse) => {
      try {
        const redirectTo = new URLSearchParams(window.location.search).get("redirect");
        const { user, token, institution, institutionName, userId, basedOn } = data;
        localStorage.setItem("smartcliff_token", token);
        localStorage.setItem("smartcliff_institution", institution);
        localStorage.setItem("smartcliff_institutionname", institutionName);
        localStorage.setItem("smartcliff_basedOn", basedOn);
        localStorage.setItem("smartcliff_userId", userId);
        localStorage.setItem("smartcliff_userData", JSON.stringify(user));
        if (user.permissions && Array.isArray(user.permissions)) {
          localStorage.setItem("smartcliff_permissions", JSON.stringify(user.permissions));
          const sorted = [...user.permissions].filter((p) => p.isActive).sort((a, b) => a.order - b.order);
          if (sorted.length > 0) localStorage.setItem("smartcliff_firstPermissionKey", sorted[0].permissionKey);
        }
        let userRoleValue = "User";
        let originalRoleValue = "";
        if (user.role) {
          if (typeof user.role === "object" && user.role !== null) {
            const roleId = user.role._id || user.role.$oid || "";
            const originalRole = user.role.originalRole || "";
            const renameRole = user.role.renameRole || "";
            const roleValue = user.role.roleValue || renameRole || originalRole || "User";
            userRoleValue = roleValue.toLowerCase();
            originalRoleValue = originalRole.toLowerCase();
            localStorage.setItem("smartcliff_roleId", roleId);
            localStorage.setItem("smartcliff_roleValue", roleValue);
            localStorage.setItem("smartcliff_originalRole", originalRole);
            localStorage.setItem("smartcliff_renameRole", renameRole);
            localStorage.setItem("smartcliff_role", JSON.stringify(user.role));
          } else {
            const roleString = String(user.role);
            userRoleValue = roleString.toLowerCase();
            originalRoleValue = roleString.toLowerCase();
            localStorage.setItem("smartcliff_role", roleString);
            localStorage.setItem("smartcliff_roleValue", roleString);
            localStorage.setItem("smartcliff_roleId", roleString);
            localStorage.setItem("smartcliff_originalRole", roleString);
          }
        } else {
          userRoleValue = "user"; originalRoleValue = "user";
          localStorage.setItem("smartcliff_role", "User");
          localStorage.setItem("smartcliff_roleValue", "User");
          localStorage.setItem("smartcliff_roleId", "");
          localStorage.setItem("smartcliff_originalRole", "User");
        }
        const verifyResponse = await fetch("https://lmsserver-yeve.onrender.com/user/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (!verifyResponse.ok) { clearAuthData(); throw new Error("Token verification failed"); }
        // IP / location / device were already captured with the login request
        // (clientInfo), so they persist even though we redirect immediately below.
        if (!user.firstTimeLoginDone) localStorage.setItem("showWelcomeToast", "true");
        // Roles with a dedicated console are routed by ROLE, ahead of both
        // ?redirect= and smartcliff_firstPermissionKey. Existing POC accounts
        // carry stale admin permission keys whose lowest-order entry is
        // `admindashboard` — a route the POC gate now denies, so honouring the
        // key would drop them straight onto Access Restricted.
        if (isPocRoleValue(userRoleValue) || isPocRoleValue(originalRoleValue)) {
          window.location.href = redirectTo && isPocRoute(redirectTo) ? redirectTo : POC_HOME;
          return;
        }
        if (redirectTo) { window.location.href = redirectTo; return; }
        const firstPermissionKey = localStorage.getItem("smartcliff_firstPermissionKey");
        if (firstPermissionKey) { window.location.href = routeForPermissionKey(firstPermissionKey); return; }
        const roleForRedirect = originalRoleValue || userRoleValue;
        window.location.href = roleForRedirect.includes("student") ? "/lms/pages/studentdashboard" : "/lms/pages/admindashboard";
      } catch (error) {
        clearAuthData();
        toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
      }
    },
    onError: (error: Error) => { showErrorToast(error.message); },
  });

  const validateForm = (): boolean => {
    let valid = true;
    const newErrors: FormErrors = { email: "", password: "" };
    if (!formData.email) { newErrors.email = "Email is required"; valid = false; }
    else if (!/\S+@\S+\.\S+/.test(formData.email)) { newErrors.email = "Please enter a valid email"; valid = false; }
    if (!formData.password) { newErrors.password = "Password is required"; valid = false; }
    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await loginMutation.mutateAsync(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  if (!mounted) {
    return (
      <div className="sc-loader">
        <div className="sc-loader__spin" />
      </div>
    );
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="sc-page">
        <div className="sc-split">

          {/* ═══ Left: Orange Carousel Panel ═══ */}
          <div className="sc-left">
            <svg className="sc-arcs" viewBox="0 0 600 900" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
              <circle cx="520" cy="160" r="110" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
              <circle cx="520" cy="160" r="190" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" />
              <circle cx="520" cy="160" r="280" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" />
              <circle cx="70" cy="760" r="100" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
              <circle cx="70" cy="760" r="180" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
            </svg>

            <div className="sc-carousel">
              {CAROUSEL_IMAGES.map((img, idx) => (
                <div
                  key={idx}
                  className={`sc-carousel__slide ${idx === activeSlide ? "sc-carousel__slide--active" : ""}`}
                >
                  <img src={img.src} alt={img.alt} />
                </div>
              ))}
            </div>

            <div className="sc-dots">
              {CAROUSEL_IMAGES.map((_, idx) => (
                <button
                  key={idx}
                  className={`sc-dot ${idx === activeSlide ? "sc-dot--active" : ""}`}
                  onClick={() => goToSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ═══ Right: Login Form ═══ */}
          <div className="sc-right">
            <div className="sc-right__inner">

              {/* Logo */}
              <div className="sc-logo">
                <div className="sc-logo__mark">
                  <GraduationCap size={20} strokeWidth={2.2} />
                </div>
                <span className="sc-logo__name">SmartCliff</span>
              </div>

              {/* Heading */}
              <h1 className="sc-title">Login</h1>
              <p className="sc-subtitle">Enter your credentials to login to your account</p>

              {/* Form */}
              <form onSubmit={handleSubmit} className="sc-form">
                <div className="sc-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email" name="email" type="email" required
                    value={formData.email} onChange={handleInputChange}
                    placeholder="example.smartcliff@gmail.com"
                    className={errors.email ? "has-error" : ""}
                  />
                  {errors.email && <span className="sc-err">{errors.email}</span>}
                </div>

                <div className="sc-field">
                  <label htmlFor="password">Password</label>
                  <div className="sc-pw-wrap">
                    <input
                      id="password" name="password"
                      type={showPassword ? "text" : "password"} required
                      value={formData.password} onChange={handleInputChange}
                      placeholder="••••••••••••••"
                      className={errors.password ? "has-error" : ""}
                    />
                    <button type="button" className="sc-pw-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <span className="sc-err">{errors.password}</span>}
                </div>

                <div className="sc-meta">
                  <label className="sc-remember">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <a href="/login/forgotPassword" className="sc-forgot">Forgot Password?</a>
                </div>

                <button type="submit" disabled={loginMutation.isPending} className="sc-submit">
                  {loginMutation.isPending ? (
                    <span className="sc-submit__loading">
                      <span className="sc-spin-icon" />
                      Signing in...
                    </span>
                  ) : "Sign In"}
                </button>

                <div className="sc-divider"><span>or</span></div>

                <button type="button" className="sc-google">
                  <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </button>

                <p className="sc-signup-link">
                  Don&apos;t have an account?{" "}
                  <a href="#">Sign Up</a>
                </p>
              </form>
            </div>

            {/* Footer */}
            <footer className="sc-footer">
              <p>&copy; {new Date().getFullYear()} All rights reserved <span>SmartCliff</span></p>
              <div className="sc-socials">
                <a href="#" aria-label="Facebook">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="#" aria-label="YouTube">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
                <a href="#" aria-label="TikTok">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
              </div>
            </footer>
          </div>

        </div>
      </div>

      <style jsx>{`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

        /* ═══ Reset & Tokens ═══ */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sc-page {
          --orange:       #F97316;
          --orange-dark:  #EA580C;
          --orange-glow:  rgba(249,115,22,0.30);
          --orange-light: rgba(249,115,22,0.08);
          --text-main:    #1a1a2e;
          --text-secondary:#6b6b7e;
          --text-muted:   #8b8b9e;
          --text-hint:    #bcbccc;
          --border:       #e4e4ed;
          --border-hover: #d0d0de;
          --bg-white:     #ffffff;
          --danger:       #e53e3e;

          /* ── Fixed, full-screen, NO scroll ── */
          position: fixed;
          inset: 0;
          width: calc(100vw * var(--ui-scale-inv, 1));
          height: calc(100vh * var(--ui-scale-inv, 1));
          overflow: hidden;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--text-main);
          background: var(--bg-white);
        }

        /* ═══ Full-screen split ═══ */
        .sc-split {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        /* ═══ Left panel ═══ */
        .sc-left {
          flex: 0 0 46%;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(120% 80% at 78% 12%, rgba(253,186,116,0.55) 0%, rgba(253,186,116,0) 45%),
            radial-gradient(110% 90% at 12% 92%, rgba(154,52,18,0.75) 0%, rgba(154,52,18,0) 50%),
            linear-gradient(155deg, #FB923C 0%, #EA580C 52%, #9A3412 100%);
          animation: fadeSlideRight 0.55s ease-out both;
        }

        /* Subtle top-highlight sheen for depth */
        .sc-left::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 22%);
          pointer-events: none;
          z-index: 1;
        }

        .sc-arcs {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
        }

        .sc-carousel {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 74%;
          max-width: 420px;
          height: 72%;
          border-radius: 20px;
          z-index: 2;
          box-shadow:
            0 30px 60px -20px rgba(67,20,7,0.55),
            0 0 0 1px rgba(255,255,255,0.10),
            0 0 0 6px rgba(255,255,255,0.06);
        }

        .sc-carousel__slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: scale(1.04);
          transition: opacity 0.6s ease, transform 0.6s ease;
          will-change: opacity, transform;
          border-radius: 20px;
          overflow: hidden;
        }

        .sc-carousel__slide--active {
          opacity: 1;
          transform: scale(1);
        }

        .sc-carousel__slide img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
          border-radius: 20px;
        }

        .sc-dots {
          position: absolute;
          bottom: clamp(28px, 8%, 64px);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 9px;
          z-index: 3;
        }

        .sc-dot {
          width: 9px; height: 9px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.7);
          background: transparent;
          cursor: pointer;
          padding: 0;
          transition: all 0.3s ease;
        }

        .sc-dot--active {
          background: #fff;
          border-color: #fff;
          transform: scale(1.2);
          box-shadow: 0 0 8px rgba(255,255,255,0.5);
        }

        .sc-dot:hover:not(.sc-dot--active) {
          background: rgba(255,255,255,0.4);
        }

        /* ═══ Right panel — flex column, FIXED height, NO scroll ═══ */
        .sc-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;          /* ← key: kill all overflow */
          animation: fadeSlideLeft 0.55s ease-out both;
        }

        /* The inner content area grows to fill space between top and footer */
        .sc-right__inner {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;          /* ← no scroll here either */
          padding: clamp(16px, 3vh, 32px) clamp(24px, 5vw, 56px);
          max-width: 460px;
          width: 100%;
          margin: 0 auto;
        }

        /* Logo */
        .sc-logo {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: clamp(14px, 2.4vh, 28px);
        }

        .sc-logo__mark {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #FB923C 0%, var(--orange) 55%, var(--orange-dark) 100%);
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .sc-logo__name {
          font-size: clamp(17px, 2vw, 21px);
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.025em;
        }

        /* Title */
        .sc-title {
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 700;
          color: var(--text-main);
          margin: 0 0 4px;
          letter-spacing: -0.02em;
        }

        .sc-subtitle {
          font-size: clamp(12px, 1.4vw, 14px);
          color: var(--text-muted);
          margin: 0 0 clamp(12px, 2vh, 24px);
          line-height: 1.5;
        }

        /* Form */
        .sc-form {
          display: flex;
          flex-direction: column;
          gap: clamp(10px, 1.6vh, 16px);
        }

        .sc-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .sc-field label {
          font-size: clamp(12px, 1.2vw, 13.5px);
          font-weight: 600;
          color: #2d2d3d;
        }

        .sc-field input[type="email"],
        .sc-field input[type="password"],
        .sc-field input[type="text"] {
          width: 100%;
          height: clamp(40px, 5.5vh, 48px);
          padding: 0 14px;
          font-size: clamp(13px, 1.3vw, 14px);
          font-family: inherit;
          color: var(--text-main);
          background: #f8f9fc;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }

        .sc-field input::placeholder {
          color: var(--text-hint);
          font-weight: 400;
        }

        .sc-field input:hover  { border-color: var(--border-hover); background: #f4f6fb; }
        .sc-field input:focus  { border-color: var(--orange); background: var(--bg-white); box-shadow: 0 0 0 4px var(--orange-light); }
        .sc-field input.has-error { border-color: var(--danger); background: #fffafa; }

        .sc-err {
          font-size: 11px;
          color: var(--danger);
          font-weight: 500;
        }

        /* Password */
        .sc-pw-wrap { position: relative; }
        .sc-pw-wrap input { padding-right: 44px; }

        .sc-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-hint);
          cursor: pointer;
          padding: 0;
          display: flex;
          transition: color 0.15s;
        }

        .sc-pw-toggle:hover { color: var(--orange); }

        /* Meta */
        .sc-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sc-remember {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          font-size: clamp(12px, 1.2vw, 13.5px);
          color: var(--text-secondary);
          user-select: none;
        }

        .sc-remember input[type="checkbox"] {
          width: 15px; height: 15px;
          accent-color: var(--orange);
          cursor: pointer;
          margin: 0;
        }

        .sc-forgot {
          font-size: clamp(12px, 1.2vw, 13.5px);
          font-weight: 600;
          color: var(--orange);
          text-decoration: none;
        }

        .sc-forgot:hover { text-decoration: underline; color: var(--orange-dark); }

        /* Submit */
        .sc-submit {
          width: 100%;
          height: clamp(42px, 5.8vh, 50px);
          background: linear-gradient(180deg, #FB923C 0%, var(--orange) 100%);
          color: #fff;
          font-family: inherit;
          font-size: clamp(14px, 1.4vw, 15.5px);
          font-weight: 600;
          letter-spacing: 0.01em;
          border: none;
          border-radius: 11px;
          cursor: pointer;
          transition: filter 0.2s, transform 0.12s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sc-submit:hover:not(:disabled) {
          filter: brightness(1.06);
          transform: translateY(-1px);
        }

        .sc-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .sc-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .sc-submit__loading { display: flex; align-items: center; gap: 9px; }

        .sc-spin-icon {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sc-spin 0.6s linear infinite;
        }

        /* Divider */
        .sc-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: clamp(2px, 0.6vh, 6px) 0;
          color: var(--text-muted);
          font-size: clamp(11px, 1.1vw, 12.5px);
          font-weight: 500;
        }
        .sc-divider::before,
        .sc-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* Google */
        .sc-google {
          width: 100%;
          height: clamp(40px, 5.2vh, 46px);
          background: var(--bg-white);
          color: var(--text-secondary);
          font-family: inherit;
          font-size: clamp(13px, 1.3vw, 14px);
          font-weight: 500;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition: border-color 0.2s, background 0.15s, box-shadow 0.2s;
        }

        .sc-google:hover {
          border-color: var(--border-hover);
          background: #fafafa;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        /* Signup */
        .sc-signup-link {
          text-align: center;
          font-size: clamp(12px, 1.2vw, 13.5px);
          color: var(--text-muted);
          margin: 0;
        }

        .sc-signup-link a {
          color: var(--orange);
          font-weight: 700;
          text-decoration: none;
        }

        .sc-signup-link a:hover { text-decoration: underline; color: var(--orange-dark); }

        /* ═══ Footer — pinned to bottom of right panel ═══ */
        .sc-footer {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px clamp(24px, 5vw, 56px);
          border-top: 1px solid #f2f2f6;
          max-width: 460px;
          width: 100%;
          margin: 0 auto;
          align-self: stretch;
        }

        /* override the max-width centering for full-width border */
        .sc-right > .sc-footer {
          max-width: 100%;
          padding: 12px clamp(24px, 5vw, 56px);
        }

        .sc-footer p {
          font-size: 12px;
          color: #a0a0b0;
          margin: 0;
        }

        .sc-footer p span { color: var(--orange); font-weight: 600; }

        .sc-socials { display: flex; gap: 8px; }

        .sc-socials a {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          color: #a0a0b0;
          border: 1px solid #e8e8ee;
          border-radius: 50%;
          text-decoration: none;
          transition: all 0.2s;
        }

        .sc-socials a:hover {
          color: var(--orange);
          border-color: var(--orange);
          background: var(--orange-light);
        }

        /* ═══ Loader ═══ */
        .sc-loader {
          width: calc(100vw * var(--ui-scale-inv, 1)); height: calc(100vh * var(--ui-scale-inv, 1));
          display: flex; align-items: center; justify-content: center;
          background: #fff;
        }

        .sc-loader__spin {
          width: 28px; height: 28px;
          border: 3px solid #f0f0f5;
          border-top-color: var(--orange, #F97316);
          border-radius: 50%;
          animation: sc-spin 0.7s linear infinite;
        }

        /* ═══ Keyframes ═══ */
        @keyframes sc-spin       { to { transform: rotate(360deg); } }
        @keyframes fadeSlideRight { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeSlideLeft  { from { opacity:0; transform:translateX(24px);  } to { opacity:1; transform:translateX(0); } }

        /* ═══════════════════════════════════
           RESPONSIVE  (all non-scroll)
           ═══════════════════════════════════ */

        /* ── Wide desktop tweak ── */
        @media (min-width: 1400px) {
          .sc-right__inner { max-width: 500px; }
          .sc-footer        { max-width: 100%; }
        }

        /* ── Narrow desktop ── */
        @media (max-width: 1100px) {
          .sc-left { flex: 0 0 42%; }
        }

        /* ── Tablet: vertical stack ──
           On tablet we allow the PAGE to scroll because
           there is genuinely not enough vertical space.
           The split panels become full-width blocks.     */
        @media (max-width: 900px) {
          .sc-page {
            position: relative;      /* allow natural height */
            height: auto;
            min-height: calc(100vh * var(--ui-scale-inv, 1));
            overflow-y: auto;        /* page-level scroll only on small screens */
          }

          .sc-split {
            flex-direction: column;
            height: auto;
            overflow: visible;
          }

          .sc-left {
            flex: none;
            width: 100%;
            height: 280px;
          }

          .sc-carousel {
            width: 50%;
            max-width: 280px;
            height: 84%;
          }

          .sc-right {
            flex: 1;
            height: auto;
            overflow: visible;
          }

          .sc-right__inner {
            flex: none;
            justify-content: flex-start;
            padding: 28px 40px;
          }

          .sc-footer {
            padding: 14px 40px;
          }
        }

        @media (max-width: 680px) {
          .sc-left { height: 220px; }

          .sc-carousel {
            width: 46%;
            max-width: 220px;
          }

          .sc-right__inner { padding: 24px 24px; }
          .sc-footer        { padding: 12px 24px; }
        }

        @media (max-width: 480px) {
          .sc-left { height: 190px; }

          .sc-carousel {
            width: 44%;
            max-width: 180px;
          }

          .sc-carousel__slide img { border-radius: 10px 10px 0 0; }
          .sc-dots  { bottom: 10px; gap: 7px; }
          .sc-dot   { width: 7px; height: 7px; }

          .sc-right__inner { padding: 20px 18px; }
          .sc-logo          { margin-bottom: 16px; }
          .sc-logo__mark    { width: 34px; height: 34px; }

          .sc-footer {
            flex-direction: column;
            gap: 8px;
            text-align: center;
            padding: 10px 16px;
          }
        }

        @media (max-width: 360px) {
          .sc-left { height: 160px; }
          .sc-right__inner { padding: 16px 14px; }
        }

        /* ── Short landscape on desktop (e.g. 768×500) ──
           Stay fixed/no-scroll, just compress further     */
        @media (max-height: 640px) and (min-width: 901px) {
          .sc-right__inner {
            padding-top: clamp(8px, 1.5vh, 16px);
            padding-bottom: clamp(8px, 1.5vh, 16px);
          }
          .sc-logo          { margin-bottom: clamp(8px, 1.2vh, 14px); }
          .sc-subtitle      { margin-bottom: clamp(8px, 1.2vh, 14px); }
          .sc-form          { gap: clamp(7px, 1.1vh, 12px); }
        }
      `}</style>
    </>
  );
};

export default SmartCliffLogin;