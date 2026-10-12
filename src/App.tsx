import { useEffect, useMemo, useRef, useState } from "react";
import { apiLogin, apiSpin, apiStatus } from "./api";
import { DEFAULT_CATEGORIES, PALETTE, TOTAL_TEAMS } from "./config";

type Screen = "login" | "wheel" | "spinning" | "result" | "already" | "locked" | "error";

interface AuthSession {
  team: number;
  name: string;
  code: string;
}

const SESSION_KEY = "bwd_session_auth";

// Web Audio API tick sound generator
class SoundController {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playTick() {
    if (this.muted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.025);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.025);
    } catch (e) {
      // ignore
    }
  }
}

const sound = new SoundController();

function pointOnCircle(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: 160 + radius * Math.cos(radians),
    y: 160 + radius * Math.sin(radians),
  };
}

function makeSlice(start: number, end: number) {
  const diff = end - start;
  if (diff >= 359.9) {
    return "M 160 12 A 148 148 0 1 1 159.9 12 Z";
  }
  const a = pointOnCircle(start, 148);
  const b = pointOnCircle(end, 148);
  const largeArcFlag = diff > 180 ? 1 : 0;
  return `M 160 160 L ${a.x} ${a.y} A 148 148 0 ${largeArcFlag} 1 ${b.x} ${b.y} Z`;
}

function TitleLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`title-lockup ${compact ? "title-lockup--compact" : ""}`}
      aria-label="Brand Wali Diwali"
    >
      <span>BRAND</span>
      <b lang="hi">वाली</b>
      <span>DIWALI</span>
    </div>
  );
}

function FestiveMotifs() {
  return (
    <div className="motifs" aria-hidden="true">
      <svg className="motif motif--diya" viewBox="0 0 100 100">
        <path d="M24 54h52c-3 19-14 28-26 28S27 73 24 54Z" />
        <path d="M32 54c6-7 30-7 36 0M50 49c-14-12 3-20 1-33 12 12 14 25-1 33Z" />
      </svg>
      <svg className="motif motif--lantern" viewBox="0 0 100 130">
        <path d="M34 18h32M29 31h42l-8 64H37l-8-64ZM37 45h26M36 79h28M42 95l-7 17M58 95l7 17" />
      </svg>
      <svg className="motif motif--burst" viewBox="0 0 100 100">
        <path d="M50 6v24M50 70v24M6 50h24M70 50h24M19 19l17 17M64 64l17 17M81 19 64 36M36 64 19 81" />
        <circle cx="50" cy="50" r="8" />
      </svg>
      <svg className="motif motif--flower" viewBox="0 0 100 100">
        <path d="M50 50C16 41 22 21 43 37 40 10 61 11 57 37c19-18 31 2 9 14 27 6 17 27-6 12 7 28-17 27-18 2-20 17-33-5-9-15-26-4-16-26 5-13Z" />
        <circle cx="50" cy="50" r="8" />
      </svg>
    </div>
  );
}

function MarqueeCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`marquee-shell ${className}`}>
      <div className="marquee-card">{children}</div>
    </div>
  );
}

function TeamPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (team: number) => void;
}) {
  const previous = value === 1 ? TOTAL_TEAMS : value - 1;
  const next = value === TOTAL_TEAMS ? 1 : value + 1;

  return (
    <div className="picker" aria-label={`Selected Team ${value}`}>
      <button
        type="button"
        className="picker-arrow"
        onClick={() => onChange(previous)}
        aria-label="Previous team"
      >
        <svg viewBox="0 0 24 24">
          <path d="m7 14 5-5 5 5" />
        </svg>
      </button>
      <span className="picker-faded">Team {previous}</span>
      <span className="picker-selected">Team {value}</span>
      <span className="picker-faded">Team {next}</span>
      <button
        type="button"
        className="picker-arrow"
        onClick={() => onChange(next)}
        aria-label="Next team"
      >
        <svg viewBox="0 0 24 24">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
    </div>
  );
}

function Wheel({
  categories,
  rotation,
  spinning,
}: {
  categories: string[];
  rotation: number;
  spinning: boolean;
}) {
  const count = categories.length;
  const sliceAngle = count > 0 ? 360 / count : 360;

  return (
    <div className={`wheel-wrap ${spinning ? "is-spinning" : ""}`}>
      <div className="wheel-sparkles" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="pointer" aria-hidden="true">
        <span />
      </div>
      <svg
        className="wheel"
        viewBox="0 0 320 320"
        role="img"
        aria-label="Product category wheel"
      >
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "160px 160px",
            transition: spinning
              ? "transform 5s cubic-bezier(0.12, 0.85, 0.15, 1)"
              : "none",
          }}
        >
        <circle cx="160" cy="160" r="157" className="wheel-rim" />
        {categories.map((category, index) => {
          const startAngle = index * sliceAngle;
          const endAngle = startAngle + sliceAngle;
          const midAngle = startAngle + sliceAngle / 2;
          const labelPoint = pointOnCircle(midAngle, count > 6 ? 96 : 90);
          const words = category.split(" ");
          const sliceColor = PALETTE[index % PALETTE.length];
          const isDarkText = sliceColor === "#FFF6CE" || sliceColor === "#FFC21C";

          return (
            <g key={`${category}-${index}`}>
              <path
                d={makeSlice(startAngle, endAngle)}
                fill={sliceColor}
                className="wheel-slice"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y - (words.length > 1 ? (count > 6 ? 6 : 8) : 0)}
                fill={isDarkText ? "#720019" : "#FFFFFF"}
                textAnchor="middle"
                transform={`rotate(${midAngle} ${labelPoint.x} ${labelPoint.y})`}
                className="wheel-label"
                style={{ fontSize: count > 6 ? "10px" : "12px", fontWeight: 700 }}
              >
                {words.map((word, wordIndex) => (
                  <tspan
                    key={word}
                    x={labelPoint.x}
                    dy={wordIndex === 0 ? 0 : count > 6 ? 12 : 14}
                  >
                    {word}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <circle cx="160" cy="160" r="53" className="wheel-hub-outer" />
        <circle cx="160" cy="160" r="45" className="wheel-hub" />
        </g>
      </svg>
    </div>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

function Diya() {
  return (
    <div className="result-diya" aria-hidden="true">
      <span className="flame" />
      <span className="bowl" />
      <i />
      <i />
      <i />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [team, setTeam] = useState(1);
  const [captain, setCaptain] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [rotation, setRotation] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [muted, setMuted] = useState(false);

  const authRef = useRef<AuthSession | null>(null);
  const spinningRef = useRef(false);

  // Load saved session on mount
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const saved: AuthSession = JSON.parse(raw);
        if (saved && saved.team && saved.name && saved.code) {
          authRef.current = saved;
          setTeam(saved.team);
          setCaptain(saved.name);
          setCode(saved.code);
          verifySession(saved);
        }
      } catch (e) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  async function verifySession(auth: AuthSession) {
    setLoading(true);
    const res = await apiStatus(auth.team, auth.name, auth.code);
    setLoading(false);

    if (res.status === "locked") {
      setScreen("locked");
      return;
    }
    if (!res.success) {
      sessionStorage.removeItem(SESSION_KEY);
      authRef.current = null;
      setScreen("login");
      return;
    }

    if (res.remaining && res.remaining.length > 0) {
      setActiveCategories(res.remaining);
    }

    if (res.allocated) {
      setSelectedCategory(res.allocated);
      setScreen("already");
    } else {
      setScreen("wheel");
    }
  }

  // Poll status every 5 seconds to sync remaining categories
  useEffect(() => {
    if (screen === "login" || screen === "locked" || screen === "spinning") return;
    if (!authRef.current) return;

    const interval = setInterval(async () => {
      if (spinningRef.current) return;
      const curAuth = authRef.current;
      if (!curAuth) return;

      const res = await apiStatus(curAuth.team, curAuth.name, curAuth.code);
      if (res.success) {
        if (res.allocated && screen !== "result" && screen !== "already") {
          setSelectedCategory(res.allocated);
          setScreen("already");
          return;
        }
        if (res.remaining) {
          // Compare before updating state
          setActiveCategories((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(res.remaining)) {
              return res.remaining!;
            }
            return prev;
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [screen]);

  async function handleEnter(event: React.FormEvent) {
    event.preventDefault();
    if (captain.trim().length < 2) {
      setLoginError("Please enter the captain's name.");
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      setLoginError("Please enter your 4-digit team code.");
      return;
    }

    setLoading(true);
    setLoginError("");

    const res = await apiLogin(team, captain.trim(), code.trim());
    setLoading(false);

    if (res.status === "locked") {
      setScreen("locked");
      return;
    }

    if (!res.success) {
      setLoginError(res.error || "Details don't match. Check with the organisers.");
      return;
    }

    // Success: store session
    const sessionData: AuthSession = { team, name: captain.trim(), code: code.trim() };
    authRef.current = sessionData;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

    // Fetch initial status
    setLoading(true);
    const statusRes = await apiStatus(team, captain.trim(), code.trim());
    setLoading(false);

    if (statusRes.remaining && statusRes.remaining.length > 0) {
      setActiveCategories(statusRes.remaining);
    }

    if (statusRes.allocated) {
      setSelectedCategory(statusRes.allocated);
      setScreen("already");
    } else {
      setScreen("wheel");
    }
  }

  function toggleMute() {
    sound.muted = !muted;
    setMuted(!muted);
  }

  async function spinWheel() {
    if (spinningRef.current || screen === "spinning") return;
    if (!authRef.current) return;

    spinningRef.current = true;
    setScreen("spinning");

    const auth = authRef.current;
    const spinRes = await apiSpin(auth.team, auth.name, auth.code);

    if (!spinRes.success) {
      spinningRef.current = false;
      if (spinRes.status === "locked") {
        setScreen("locked");
      } else {
        setErrorMessage(spinRes.error || "Spin failed. Please try again.");
        setScreen("error");
      }
      return;
    }

    if (spinRes.alreadySpun) {
      spinningRef.current = false;
      setSelectedCategory(spinRes.category || "");
      setScreen("already");
      return;
    }

    const wonCategory = spinRes.category!;
    const currentCats = [...activeCategories];
    let targetIndex = currentCats.findIndex(
      (c) => c.trim().toLowerCase() === wonCategory.trim().toLowerCase()
    );

    // If for any reason wonCategory is not in activeCategories, add it
    if (targetIndex === -1) {
      currentCats.push(wonCategory);
      setActiveCategories(currentCats);
      targetIndex = currentCats.length - 1;
    }

    const count = currentCats.length;
    const sliceAngle = 360 / count;
    // The center angle of the winning slice (clockwise from 12 o'clock)
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;

    // Pointer is at 12 o'clock (0 deg).
    // To bring targetSliceCenter to 0 deg clockwise:
    const targetModulo = ((360 - (targetSliceCenter % 360)) % 360 + 360) % 360;
    const currentModulo = ((rotation % 360) + 360) % 360;

    let forwardAngle = targetModulo - currentModulo;
    if (forwardAngle <= 0) {
      forwardAngle += 360;
    }

    // Fast start, long ease-out: 7 full turns (2520 deg) + exact forward distance
    const finalRotation = rotation + (360 * 7) + forwardAngle;

    setRotation(finalRotation);

    // Synchronize ticking sound with 5-second rotation
    const startTimestamp = performance.now();
    const duration = 5000;
    let lastSliceTick = -1;

    // Cubic-bezier(0.12, 0.85, 0.15, 1) approximation
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

    const tickInterval = () => {
      if (!spinningRef.current) return;
      const elapsed = performance.now() - startTimestamp;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOut(progress);
      const curDeg = rotation + (finalRotation - rotation) * easedProgress;

      const currentSlice = Math.floor(curDeg / sliceAngle);
      if (currentSlice !== lastSliceTick) {
        sound.playTick();
        lastSliceTick = currentSlice;
      }

      if (progress < 1) {
        requestAnimationFrame(tickInterval);
      }
    };
    requestAnimationFrame(tickInterval);

    // Completion after 5 seconds: show result popup without shifting wheel slices
    window.setTimeout(() => {
      spinningRef.current = false;
      setSelectedCategory(wonCategory);
      setScreen("result");
    }, 5000);
  }

  function resetLogin() {
    sessionStorage.removeItem(SESSION_KEY);
    authRef.current = null;
    setScreen("login");
    setCaptain("");
    setCode("");
    setLoginError("");
    setErrorMessage("");
  }

  const showMain = screen !== "login" && screen !== "locked";

  return (
    <main className="app">
      <div className="corner-swirl corner-swirl--top" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="corner-swirl corner-swirl--bottom" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <FestiveMotifs />

      <header className="hero">
        <div className="hero-band">
          <TitleLockup />
          <div className="battle-stamp">BRAND BATTLE</div>
        </div>
        <p className="tagline">
          THINK. <b>CREATE.</b> PITCH. <b>WIN.</b>
        </p>
      </header>

      {showMain && (
        <section className="game" aria-live="polite">
          <div className="team-row">
            <div>
              <span className="eyebrow">WELCOME, CAPTAIN</span>
              <h1>Team {team}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="count-chip">
                <i /> Categories left: <b>{activeCategories.length}</b>
              </div>
              <button
                type="button"
                className="sound-toggle"
                onClick={toggleMute}
                title={muted ? "Unmute sounds" : "Mute sounds"}
                style={{
                  background: "#fff6ce",
                  border: "2px solid #03577b",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  boxShadow: "2px 2px 0 #03577b",
                  marginLeft: "8px",
                  cursor: "pointer",
                }}
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>

          <div className="wheel-stage">
            <Wheel
              categories={activeCategories}
              rotation={rotation}
              spinning={screen === "spinning"}
            />
            <button
              className="spin-button"
              type="button"
              disabled={screen === "spinning" || screen === "already" || activeCategories.length === 0}
              onClick={spinWheel}
            >
              <span>{screen === "spinning" ? "HOLD" : "SPIN"}</span>
            </button>
          </div>
          <p className="instruction">
            {screen === "spinning"
              ? "Finding your perfect challenge..."
              : activeCategories.length === 0
              ? "All categories have been allocated!"
              : "Tap the button and let fate pick your brief!"}
          </p>
        </section>
      )}

      {/* Login Modal */}
      {screen === "login" && (
        <div className="overlay">
          <MarqueeCard className="login-modal">
            <div className="modal-lockup">
              <TitleLockup compact />
            </div>
            <div className="mini-stamp">BRAND BATTLE</div>
            <p className="login-intro">
              Choose your team and get ready to create some magic.
            </p>
            <form onSubmit={handleEnter}>
              <label className="field-label">SELECT YOUR TEAM</label>
              <TeamPicker
                value={team}
                onChange={(newTeam) => {
                  setTeam(newTeam);
                  setLoginError("");
                }}
              />
              <label className="field-label" htmlFor="captain">
                TEAM CAPTAIN
              </label>
              <input
                id="captain"
                value={captain}
                onChange={(event) => setCaptain(event.target.value)}
                placeholder="Team captain's name"
                autoComplete="name"
              />
              <label className="field-label" htmlFor="team-code">
                TEAM CODE
              </label>
              <input
                id="team-code"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="4-digit team code"
                inputMode="numeric"
              />
              {loginError && (
                <p className="error-message" role="alert">
                  {loginError}
                </p>
              )}
              <button type="submit" className="enter-button" disabled={loading}>
                {loading ? "CHECKING..." : "ENTER"} <span>→</span>
              </button>
            </form>
          </MarqueeCard>
        </div>
      )}

      {/* Result Modal */}
      {screen === "result" && (
        <div className="overlay overlay--dark">
          <Confetti />
          <MarqueeCard className="result-modal">
            <Diya />
            <span className="eyebrow">YOUR CATEGORY IS</span>
            <h2>{selectedCategory}</h2>
            <p className="saved-note">
              <span>✓</span> Saved. Good luck!
            </p>
            <button type="button" className="close-button" onClick={resetLogin}>
              CLOSE
            </button>
          </MarqueeCard>
        </div>
      )}

      {/* Already Spun Modal */}
      {screen === "already" && (
        <div className="overlay overlay--dark">
          <MarqueeCard className="already-modal">
            <div className="status-icon">
              <svg viewBox="0 0 48 48">
                <path d="M24 5a19 19 0 1 0 19 19A19 19 0 0 0 24 5Zm0 10v10l7 5" />
              </svg>
            </div>
            <span className="eyebrow">YOU&apos;VE ALREADY SPUN</span>
            <h2>{selectedCategory}</h2>
            <p>
              Your challenge is saved. Now go build a pitch they can&apos;t forget.
            </p>
            <button type="button" className="close-button" onClick={resetLogin}>
              DONE
            </button>
          </MarqueeCard>
        </div>
      )}

      {/* Locked Modal */}
      {screen === "locked" && (
        <div className="overlay">
          <MarqueeCard className="locked-modal">
            <div className="status-icon status-icon--lock">
              <svg viewBox="0 0 48 48">
                <path d="M13 22h22v20H13V22Zm5 0v-7a6 6 0 0 1 12 0v7M24 29v6" />
              </svg>
            </div>
            <span className="eyebrow">ACCESS PAUSED</span>
            <h2>Too many attempts</h2>
            <p>Contact the organisers to verify your team details.</p>
            <button type="button" className="close-button" onClick={resetLogin}>
              TRY AGAIN
            </button>
          </MarqueeCard>
        </div>
      )}

      {/* Generic Error Modal */}
      {screen === "error" && (
        <div className="overlay">
          <MarqueeCard className="locked-modal">
            <div className="status-icon" style={{ background: "#e31e4b" }}>
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" />
                <path d="M24 14v14M24 34h.01" />
              </svg>
            </div>
            <span className="eyebrow">ERROR</span>
            <h2>Something went wrong</h2>
            <p>{errorMessage}</p>
            <button type="button" className="close-button" onClick={() => setScreen("wheel")}>
              BACK
            </button>
          </MarqueeCard>
        </div>
      )}

      <footer>
        Organised by <b>Market Wizardz</b> <span>|</span> Faculty of Management, JLU
      </footer>
    </main>
  );
}
