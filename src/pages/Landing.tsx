import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { 
  ShieldCheck, Zap, Scale, ArrowRight, BrainCircuit, 
  Sparkles, CheckCircle2, AlertCircle, Play, RefreshCw, 
  TrendingUp, Clock, FileText, Lock, ChevronRight, Check
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

gsap.registerPlugin(ScrollTrigger);

export function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const simulatorRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Simulator State
  const [simStep, setSimStep] = useState<number>(0);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [typedText, setTypedText] = useState<string>("");

  const fullRebuttalText = `Based on transaction log #TX-89421, customer received goods at verified address (IP: 192.168.1.1, GPS: 37.7749). Delivery signature confirmed on 2026-07-24 via FedEx tracking #77490218. Chargeback under Reason Code 10.4 is fraudulent. Rebuttal packet approved.`;

  // Simulator execution logic
  const runSimulation = () => {
    if (simRunning) return;
    setSimRunning(true);
    setSimStep(1);
    setTypedText("");

    setTimeout(() => setSimStep(2), 1200);
    setTimeout(() => {
      setSimStep(3);
      // Type out the AI text
      let i = 0;
      const interval = setInterval(() => {
        if (i < fullRebuttalText.length) {
          setTypedText((prev) => prev + fullRebuttalText.charAt(i));
          i++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setSimStep(4);
            setSimRunning(false);
          }, 800);
        }
      }, 15);
    }, 2400);
  };

  useEffect(() => {
    // Initial simulation on page load
    const timer = setTimeout(() => {
      runSimulation();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // GSAP Animations & Cursor Glow
  useEffect(() => {
    // Mouse Glow Follower
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        gsap.to(cursorRef.current, {
          x: e.clientX,
          y: e.clientY,
          duration: 0.8,
          ease: "power2.out",
        });
      }
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Hero Entry Animation Timeline
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (badgeRef.current) {
      tl.fromTo(badgeRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 });
    }
    if (titleRef.current) {
      tl.fromTo(titleRef.current, { y: 30, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.9 }, "-=0.4");
    }
    if (subtitleRef.current) {
      tl.fromTo(subtitleRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.5");
    }
    if (actionsRef.current) {
      tl.fromTo(actionsRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.4");
    }

    // ScrollTrigger Parallax for Floating Badges
    const parallaxBadges = document.querySelectorAll(".parallax-badge");
    parallaxBadges.forEach((badge) => {
      gsap.to(badge, {
        y: -60,
        scrollTrigger: {
          trigger: heroRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1.5,
        },
      });
    });

    // ScrollTrigger Stagger for Feature Cards
    if (featuresRef.current) {
      const cards = featuresRef.current.querySelectorAll(".glass-card");
      gsap.fromTo(
        cards,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: featuresRef.current,
            start: "top 80%",
          },
        }
      );
    }

    // GSAP Stat Counter
    if (statsRef.current) {
      const statNumbers = statsRef.current.querySelectorAll(".stat-number");
      statNumbers.forEach((stat) => {
        const val = stat.getAttribute("data-value");
        if (val) {
          gsap.fromTo(
            stat,
            { innerText: 0 },
            {
              innerText: val,
              duration: 2,
              snap: { innerText: 1 },
              scrollTrigger: {
                trigger: statsRef.current,
                start: "top 85%",
              },
            }
          );
        }
      });
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // 3D Card Tilt Effect
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(card, {
      rotationY: x * 0.05,
      rotationX: -y * 0.05,
      ease: "power1.out",
      duration: 0.4,
    });
  };

  const handleCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, {
      rotationY: 0,
      rotationX: 0,
      ease: "power2.out",
      duration: 0.5,
    });
  };

  return (
    <div className="landing-page" ref={heroRef}>
      {/* Background Cyber Grid & Glowing Orbs */}
      <div className="bg-grid" />
      <div className="cursor-glow" ref={cursorRef} />

      {/* Floating Navigation Header */}
      <header className="landing-header">
        <nav className="nav-glass-bar">
          <div className="brand-logo">
            <div className="brand-icon-wrapper">
              <ShieldCheck size={20} />
            </div>
            <span>ChargebackShield</span>
          </div>

          <div className="nav-links">
            <span className="nav-item" onClick={() => simulatorRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Live Simulator
            </span>
            <span className="nav-item" onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Features
            </span>
            <button className="nav-btn" onClick={() => navigate("/app")}>
              Dashboard <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <div className="landing-container">
        <section className="hero-section">
          {/* Parallax Floating Badges */}
          <div className="parallax-badge badge-left">
            <div className="pulse-dot" />
            <div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Interception Alert</div>
              <div className="badge-amount">$450.00 Disputed</div>
            </div>
            <span className="badge-status auto">Auto-Intercepted</span>
          </div>

          <div className="parallax-badge badge-right">
            <ShieldCheck size={18} color="#34d399" />
            <div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Stripe Response</div>
              <div className="badge-amount">Evidence Submitted</div>
            </div>
            <span className="badge-status won">100% Complete</span>
          </div>

          <div className="hero-badge" ref={badgeRef}>
            <div className="pulse-dot" />
            <Sparkles size={16} />
            <span>AI Dispute Interception Engine v2.4</span>
          </div>

          <h1 className="hero-title" ref={titleRef}>
            Win Chargebacks on Autopilot
          </h1>

          <p className="hero-subtitle" ref={subtitleRef}>
            ChargebackShield automatically intercepts Stripe disputes, gathers order & shipping telemetry, drafts AI legal rebuttals, and submits evidence packets before the deadline.
          </p>

          <div className="hero-actions" ref={actionsRef}>
            <button className="cta-button" onClick={() => navigate("/app")}>
              Enter App Dashboard <ArrowRight size={20} />
            </button>
            <button className="cta-button-secondary" onClick={runSimulation}>
              <Play size={18} /> Test Live Simulator
            </button>
          </div>

          {/* Interactive Live AI Simulator */}
          <div className="simulator-section" ref={simulatorRef}>
            <div className="glass-simulator-card">
              <div className="simulator-header">
                <div className="mac-controls">
                  <div className="mac-dot red" />
                  <div className="mac-dot yellow" />
                  <div className="mac-dot green" />
                </div>
                <div className="simulator-title-bar">
                  <BrainCircuit size={16} color="#818cf8" /> ChargebackShield Defense Engine (Active)
                </div>
                <button 
                  onClick={runSimulation} 
                  disabled={simRunning}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                  title="Re-run Simulation"
                >
                  <RefreshCw size={16} className={simRunning ? "spin" : ""} />
                </button>
              </div>

              <div className="simulator-body">
                {/* Left: Dispute Info & Workflow Steps */}
                <div className="sim-info-box">
                  <div className="sim-row">
                    <span className="sim-label">Dispute ID:</span>
                    <span className="sim-value">dp_1N9xK200921A</span>
                  </div>
                  <div className="sim-row">
                    <span className="sim-label">Disputed Amount:</span>
                    <span className="sim-value" style={{ color: "#f87171" }}>$450.00 USD</span>
                  </div>
                  <div className="sim-row">
                    <span className="sim-label">Reason Code:</span>
                    <span className="sim-value">Fraudulent (10.4)</span>
                  </div>

                  <div className="sim-steps">
                    <div className={`sim-step-item ${simStep >= 1 ? (simStep > 1 ? "done" : "active") : ""}`}>
                      {simStep > 1 ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                      <span>1. Webhook Intercepted</span>
                    </div>
                    <div className={`sim-step-item ${simStep >= 2 ? (simStep > 2 ? "done" : "active") : ""}`}>
                      {simStep > 2 ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                      <span>2. Evidence Packet Compiled</span>
                    </div>
                    <div className={`sim-step-item ${simStep >= 3 ? (simStep > 3 ? "done" : "active") : ""}`}>
                      {simStep > 3 ? <CheckCircle2 size={16} /> : <BrainCircuit size={16} />}
                      <span>3. AI Legal Rebuttal Drafted</span>
                    </div>
                    <div className={`sim-step-item ${simStep >= 4 ? "done active" : ""}`}>
                      {simStep >= 4 ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                      <span>4. Approved & Submitted to Stripe</span>
                    </div>
                  </div>

                  <button className="sim-trigger-btn" onClick={runSimulation} disabled={simRunning}>
                    {simRunning ? "AI Defense Processing..." : "Re-run Live Defense Simulation"}
                  </button>
                </div>

                {/* Right: AI Rebuttal Terminal Stream */}
                <div className="sim-output-box">
                  <div>
                    <div style={{ color: "#38bdf8", marginBottom: "10px", fontWeight: 700 }}>
                      &gt; SYSTEM_OUTPUT: LLM Defense Strategy Generation
                    </div>
                    <div className="sim-output-text">
                      {typedText || "// Click 'Test Live Simulator' above to trigger automated evidence assembly and AI generation..."}
                    </div>
                  </div>

                  {simStep === 4 && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{ 
                        marginTop: "16px", 
                        padding: "10px 14px", 
                        background: "rgba(16, 185, 129, 0.15)", 
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        borderRadius: "8px",
                        color: "#34d399",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <CheckCircle2 size={18} /> Dispute Defense Package Submitted to Stripe API
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Count-up Banner */}
          <div className="stats-banner" ref={statsRef}>
            <div className="stat-card-glass">
              <div className="stat-number" data-value="98">98%</div>
              <div className="stat-desc">Evidence Match Rate</div>
            </div>

            <div className="stat-card-glass">
              <div className="stat-number" data-value="12">12s</div>
              <div className="stat-desc">Avg Interception Time</div>
            </div>

            <div className="stat-card-glass">
              <div className="stat-number" data-value="450">$450k+</div>
              <div className="stat-desc">Merchant Revenue Saved</div>
            </div>

            <div className="stat-card-glass">
              <div className="stat-number" data-value="100">100%</div>
              <div className="stat-desc">Stripe API Compliance</div>
            </div>
          </div>
        </section>

        {/* Features Showcase Section */}
        <section style={{ padding: "40px 0" }}>
          <div className="section-heading-group">
            <div className="section-tag">Next-Gen Defense Capabilities</div>
            <h2 className="section-title">Built for High-Volume Merchants</h2>
          </div>

          <div className="features-grid" ref={featuresRef}>
            <div 
              className="glass-card" 
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="feature-icon-wrapper">
                <Zap size={26} />
              </div>
              <h3 className="feature-title">Instant Telemetry Assembly</h3>
              <p className="feature-desc">
                The moment a dispute hits your Stripe account, ChargebackShield automatically aggregates customer IP, delivery tracking proof, signature logs, and terms acceptance into a single packet.
              </p>
            </div>

            <div 
              className="glass-card" 
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="feature-icon-wrapper">
                <BrainCircuit size={26} />
              </div>
              <h3 className="feature-title">Reason Code AI Rebuttals</h3>
              <p className="feature-desc">
                Generative AI models craft persuasive, legal-compliant rebuttal arguments tailored specifically to Stripe & Visa/Mastercard reason codes (Fraud, Product Not Received, Unrecognized).
              </p>
            </div>

            <div 
              className="glass-card" 
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="feature-icon-wrapper">
                <Scale size={26} />
              </div>
              <h3 className="feature-title">Human-in-the-Loop Control</h3>
              <p className="feature-desc">
                Maintain 100% oversight. Review AI-drafted statements, upload custom receipts or evidence files, and submit with one click—or turn on Full Autopilot for automatic submission.
              </p>
            </div>
          </div>
        </section>

        {/* Traditional Manual vs. ChargebackShield Matrix */}
        <section className="comparison-section">
          <div className="section-heading-group">
            <div className="section-tag">Why Merchants Switch</div>
            <h2 className="section-title">Stop Losing Money to Manual Chargebacks</h2>
          </div>

          <div className="glass-comparison-box">
            <div className="comp-column traditional">
              <div className="comp-header traditional">
                <AlertCircle size={22} /> Traditional Manual Process
              </div>
              <ul className="comp-list">
                <li className="comp-item"><AlertCircle size={16} color="#f87171" /> Spent 45+ minutes searching for PDFs and tracking receipts.</li>
                <li className="comp-item"><AlertCircle size={16} color="#f87171" /> Generic, template-based rebuttals ignored by banks.</li>
                <li className="comp-item"><AlertCircle size={16} color="#f87171" /> Missed deadlines result in automatic lost revenue and fee penalties.</li>
                <li className="comp-item"><AlertCircle size={16} color="#f87171" /> Win rates average under 25%.</li>
              </ul>
            </div>

            <div className="comp-column shield">
              <div className="comp-header shield">
                <ShieldCheck size={22} /> With ChargebackShield
              </div>
              <ul className="comp-list">
                <li className="comp-item shield-item"><Check size={16} color="#34d399" /> Instant evidence aggregation via Stripe webhooks.</li>
                <li className="comp-item shield-item"><Check size={16} color="#34d399" /> Customized AI legal rebuttal generated in under 3 seconds.</li>
                <li className="comp-item shield-item"><Check size={16} color="#34d399" /> Automated submission days before deadline expiration.</li>
                <li className="comp-item shield-item"><Check size={16} color="#34d399" /> Win rates reach up to 98% with verifiable audit trails.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Footer Glass Banner */}
        <div className="cta-banner-glass">
          <h2 className="cta-banner-title">Protect Your Revenue Today</h2>
          <p className="cta-banner-desc">
            Experience automated dispute interception, AI rebuttal drafting, and automated Stripe submissions in real time.
          </p>
          <button className="cta-button" onClick={() => navigate("/app")}>
            Launch ChargebackShield <ArrowRight size={20} />
          </button>
        </div>

        {/* Footer */}
        <footer className="landing-footer">
          <div>© 2026 ChargebackShield Inc. Built with GSAP & Base44 SDK.</div>
          <div style={{ display: "flex", gap: "20px" }}>
            <span style={{ cursor: "pointer" }} onClick={() => navigate("/app")}>Dispute Queue</span>
            <span style={{ cursor: "pointer" }} onClick={() => navigate("/app/dashboard")}>Analytics</span>
            <span style={{ cursor: "pointer" }} onClick={() => navigate("/app/settings")}>Settings</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
