'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play, SkipForward, RotateCcw, Users, Clock, Check, Award, Copy, CheckCircle, Volume2, VolumeX, Plus, Trash2, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '@/lib/sounds';

// Register ChartJS components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PlayerData {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  lastAnswer: string | null;
  lastScoreAdded: number;
  hasAnswered: boolean;
}

interface ReactionData {
  id: string;
  emoji: string;
  timestamp: number;
  nickname: string;
}

interface GameStatus {
  id: string;
  status: 'setup' | 'lobby' | 'question' | 'results' | 'gameover';
  currentQuestionIndex: number;
  timer: number;
  questionTimerSetting?: number;
  currentQuestion: { id: string; text: string } | null;
  players: PlayerData[];
  reactions?: ReactionData[];
  totalQuestions: number;
}

// Built-in game packages
const QUESTION_PACKAGES = {
  morning: [
    { id: 'm1', text: 'מהו מאכל ארוחת העשר הכי גרוע שיש?' },
    { id: 'm2', text: 'מי מהכיתה הכי סביר שיאחר לשיעור הראשון בבוקר?' },
    { id: 'm3', text: 'מהו התירוץ הכי נפוץ או הכי גרוע לאי-הכנת שיעורי בית?' },
    { id: 'm4', text: 'אם המחנכ/ת היה גיבור-על, איזה כוח-על היה לו/לה?' },
    { id: 'm5', text: 'איזו מילה המורים אומרים הכי הרבה פעמים ביום?' }
  ],
  classmate: [
    { id: 'c1', text: 'אם הכיתה שלנו הייתה נתקעת על אי בודד, מי היה שורד הכי הרבה זמן?' },
    { id: 'c2', text: 'מי מהכיתה הכי סביר שיירדם באמצע שיעור חשוב?' },
    { id: 'c3', text: 'מי הכי סביר שיהפוך למיליונר מסטארט-אפ הזוי ומצחיק?' },
    { id: 'c4', text: 'מי בכיתה תמיד מכין את הסיכומים והמחברות הכי יפים למבחן?' },
    { id: 'c5', text: 'מי הכי סביר שינהל בעתיד את בית הספר שלנו?' }
  ],
  popculture: [
    { id: 'p1', text: 'איזה שיר הכי מייצג את האווירה בכיתה שלנו?' },
    { id: 'p2', text: 'מהו החטיף האולטימטיבי שאפשר לקנות בקיוסק של בית הספר?' },
    { id: 'p3', text: 'איזה סרט כולם בכיתה היו מסכימים לראות עכשיו בשיעור חופשי?' },
    { id: 'p4', text: 'איזה משחק מחשב או טלפון הכי פופולרי בהפסקות כרגע?' },
    { id: 'p5', text: 'איזו רשת חברתית היא הכי מבוקשת בכיתה?' }
  ]
};

const normalizeAnswer = (ans: string): string => {
  if (!ans) return '';
  return ans
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
    .toLowerCase();
};

export default function HostScreen() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [status, setStatus] = useState<GameStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');

  // Setup Customizer States
  const [activePackage, setActivePackage] = useState<'morning' | 'classmate' | 'popculture' | 'custom'>('morning');
  const [customQuestions, setCustomQuestions] = useState<{ id: string; text: string }[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [timerSetting, setTimerSetting] = useState<number>(30);

  // Audio and Floating Reactions States
  const [muted, setMuted] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; left: number; createdAt: number }[]>([]);

  // Refs to track state transitions and player counts for sound effects
  const prevStatus = useRef('');
  const prevPlayerCount = useRef(0);
  const renderedReactionIds = useRef<Set<string>>(new Set());

  // 1. Establish the Join URL for QR generation using server IP address detection
  useEffect(() => {
    if (!roomId || roomId === '[roomId]' || roomId.startsWith('[')) return;

    fetch('/api/game/ip')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setJoinUrl(`http://${data.host}/?roomId=${roomId}`);
        } else {
          setJoinUrl(`${window.location.origin}/?roomId=${roomId}`);
        }
      })
      .catch(() => {
        setJoinUrl(`${window.location.origin}/?roomId=${roomId}`);
      });
    
    setMuted(sounds.isMuted);
    setCustomQuestions([...QUESTION_PACKAGES.morning]); // Load baseline questions
  }, [roomId]);

  // 2. Poll Game Status every 1.5 seconds
  useEffect(() => {
    if (!roomId || roomId === '[roomId]' || roomId.startsWith('[')) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/game/status?roomId=${roomId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setErrorMsg('החדר נסגר או לא קיים');
            return;
          }
          throw new Error('שגיאה בקבלת נתוני החדר');
        }
        const data = await res.json();
        if (data.success) {
          setStatus(data.session);

          // Render new reactions
          if (data.session.reactions && data.session.reactions.length > 0) {
            const newReactions = data.session.reactions.filter((r: ReactionData) => !renderedReactionIds.current.has(r.id));
            if (newReactions.length > 0) {
              const now = Date.now();
              setFloatingReactions(prev => [
                ...prev,
                ...newReactions.map((r: ReactionData) => {
                  renderedReactionIds.current.add(r.id);
                  return {
                    id: r.id,
                    emoji: r.emoji,
                    left: Math.random() * 80 + 10, // Horizontal percentage offset
                    createdAt: now
                  };
                })
              ]);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, [roomId]);

  // 3. Audio transition triggers based on status and player changes
  useEffect(() => {
    if (!status) return;

    // A. Detect player joins in lobby
    if (status.status === 'lobby') {
      if (status.players.length > prevPlayerCount.current) {
        if (prevPlayerCount.current > 0) {
          sounds.playJoin();
        }
        prevPlayerCount.current = status.players.length;
      }
    } else {
      prevPlayerCount.current = 0; // reset
    }

    // B. Detect game stage transitions
    if (prevStatus.current === 'question' && status.status === 'results') {
      sounds.playBuzzer();
      setTimeout(() => {
        sounds.playReveal();
      }, 500); // short delay after buzzer
    } else if (prevStatus.current === 'results' && status.status === 'gameover') {
      sounds.playVictory();
    }

    prevStatus.current = status.status;
  }, [status]);

  // 4. Incrementally tick the timer on the server every second during question phase
  useEffect(() => {
    if (status?.status !== 'question') return;

    const tickTimer = setInterval(async () => {
      try {
        // Play woodblock clock tick for countdown tension
        if (status && status.timer > 0) {
          sounds.playTick(status.timer);
        }
        await fetch('/api/game/host/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, action: 'tick' })
        });
      } catch (err) {
        console.error('Timer tick error:', err);
      }
    }, 1000);

    return () => clearInterval(tickTimer);
  }, [status?.status, roomId, status?.timer]);

  // 5. Trigger confetti at GameOver
  useEffect(() => {
    if (status?.status === 'gameover') {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [status?.status]);

  // 6. Cleanup floating reactions older than 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setFloatingReactions(prev => prev.filter(r => now - r.createdAt < 3500));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // 7. Host controls triggers
  const triggerAction = async (action: string, payload?: any) => {
    try {
      const res = await fetch('/api/game/host/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, action, payload })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.session);
      }
    } catch (err) {
      console.error('Host action error:', err);
    }
  };

  const toggleMute = () => {
    sounds.isMuted = !sounds.isMuted;
    setMuted(sounds.isMuted);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper: Get active questions to submit on Setup Open-Lobby
  const getActiveQuestionList = () => {
    if (activePackage === 'custom') {
      return customQuestions;
    }
    return QUESTION_PACKAGES[activePackage];
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newQuestionText.trim();
    if (!text) return;

    const newQuestion = {
      id: `custom_${Math.random().toString(36).substring(2, 9)}`,
      text
    };

    if (activePackage !== 'custom') {
      setCustomQuestions([...QUESTION_PACKAGES[activePackage], newQuestion]);
      setActivePackage('custom');
    } else {
      setCustomQuestions([...customQuestions, newQuestion]);
    }
    setNewQuestionText('');
  };

  const handleDeleteQuestion = (id: string) => {
    if (activePackage !== 'custom') {
      const cloned = [...QUESTION_PACKAGES[activePackage]];
      setCustomQuestions(cloned.filter(q => q.id !== id));
      setActivePackage('custom');
    } else {
      setCustomQuestions(customQuestions.filter(q => q.id !== id));
    }
  };

  // Helper: Normalize answers for grouping in chart
  const getChartData = () => {
    if (!status) return { labels: [], datasets: [] };

    const groups: Record<string, { display: string; count: number }> = {};
    
    status.players.forEach(p => {
      if (!p.lastAnswer) return;
      const norm = normalizeAnswer(p.lastAnswer);
      
      if (!groups[norm]) {
        groups[norm] = { display: p.lastAnswer, count: 0 };
      }
      groups[norm].count += 1;
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.count - a.count);

    const labels = sortedGroups.map(g => g.display);
    const counts = sortedGroups.map(g => g.count);

    return {
      labels,
      datasets: [
        {
          label: 'מספר מצביעים',
          data: counts,
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#8b5cf6';
            
            const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
            const index = context.dataIndex;
            
            if (index === 0) {
              gradient.addColorStop(0, '#f59e0b'); // gold / honey glow
              gradient.addColorStop(1, '#fbbf24');
            } else if (index === 1) {
              gradient.addColorStop(0, '#8b5cf6'); // neon purple
              gradient.addColorStop(1, '#a78bfa');
            } else if (index === 2) {
              gradient.addColorStop(0, '#ec4899'); // neon pink
              gradient.addColorStop(1, '#f472b6');
            } else {
              gradient.addColorStop(0, '#10b981'); // neon green
              gradient.addColorStop(1, '#34d399');
            }
            return gradient;
          },
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 32,
        }
      ]
    };
  };

  // Helper: Get grouped answers with user name and avatar disclosures
  const getDisclosedGroupedAnswers = () => {
    if (!status) return [];

    const groups: Record<string, { display: string; count: number; players: { nickname: string; avatar: string }[] }> = {};
    
    status.players.forEach(p => {
      if (!p.lastAnswer) return;
      const norm = normalizeAnswer(p.lastAnswer);
      
      if (!groups[norm]) {
        groups[norm] = { display: p.lastAnswer, count: 0, players: [] };
      }
      groups[norm].count += 1;
      groups[norm].players.push({ nickname: p.nickname, avatar: p.avatar });
    });

    return Object.values(groups).sort((a, b) => b.count - a.count);
  };

  if (errorMsg) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2>שגיאת מארח</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem 0' }}>{errorMsg}</p>
          <button onClick={() => router.push('/')} className="btn-primary">חזרה למסך הבית</button>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-pulse-glow" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-yellow)', margin: '0 auto 1.5rem auto' }}></div>
          <h2>טוען חדר מנחה... 🐝</h2>
        </div>
      </div>
    );
  }

  const totalPlayers = status.players.length;
  const answeredCount = status.players.filter(p => p.hasAnswered).length;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '96vh', justifyContent: 'space-between', position: 'relative' }}>
      
      {/* Floating Emojis Reaction Overlay */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
        {floatingReactions.map(r => (
          <div key={r.id} className="floating-emoji" style={{ left: `${r.left}%` }}>
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Decorative ambient floating bees */}
      <div className="ambient-bee" style={{ top: '12%', left: '8%', animation: 'beeHover 20s infinite ease-in-out' }}>🐝</div>
      <div className="ambient-bee" style={{ bottom: '25%', right: '9%', animation: 'beeHover 24s infinite ease-in-out alternate' }}>🐝</div>

      {/* Top Session Details bar */}
      <header className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '2.2rem', animation: 'beeFlap 1s infinite alternate ease-in-out', display: 'inline-block' }}>🐝</span>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>המוח הכוורתי</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>מסך מנחה ראשי</span>
          </div>
        </div>

        {status.status !== 'setup' && status.status !== 'lobby' && status.status !== 'gameover' && (
          <div style={{ background: 'rgba(139,92,246,0.1)', padding: '0.5rem 1.25rem', borderRadius: '30px', border: '1px solid var(--panel-border)', fontWeight: 600 }}>
            <span>שאלה {status.currentQuestionIndex + 1} מתוך {status.totalQuestions}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {status.status !== 'setup' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Users size={18} style={{ color: 'var(--accent-yellow)' }} />
              <span style={{ fontWeight: 600 }}>שחקנים מחוברים: <strong style={{ color: 'var(--accent-yellow)', fontSize: '1.1rem' }}>{totalPlayers}</strong></span>
            </div>
          )}
          
          <button 
            onClick={toggleMute} 
            className="btn-secondary" 
            style={{ padding: '0.5rem', borderRadius: '12px', width: '40px', height: '40px' }}
            title={muted ? 'בטל השתקת לוח' : 'השתק לוח'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main interactive state panels */}
      <main style={{ flex: 1, margin: '1.5rem 0', display: 'flex' }}>

        {/* 1. SETUP STATE */}
        {status.status === 'setup' && (
          <div className="animate-pop-in" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            
            {/* Setup Column 1: Package Selector & Questions List */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
              <h2 style={{ fontSize: '1.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 800 }}>
                ⚙️ הגדרת חדר משחק
              </h2>
              
              {/* Question Packages Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-light)' }}>חבילת שאלות כיתתית:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6fr' }}>
                  <button
                    type="button"
                    onClick={() => { setActivePackage('morning'); }}
                    className={activePackage === 'morning' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.8rem 0.5rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '0.5rem' }}
                  >
                    🏫 פתיחת בוקר
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePackage('classmate'); }}
                    className={activePackage === 'classmate' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.8rem 0.5rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '0.5rem' }}
                  >
                    👥 דינמיקה כיתתית
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActivePackage('popculture'); }}
                    className={activePackage === 'popculture' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.8rem 0.5rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '0.5rem' }}
                  >
                    👾 תרבות ופנאי
                  </button>
                  <button
                    type="button"
                    onClick={() => { 
                      if (customQuestions.length === 0) {
                        setCustomQuestions([...QUESTION_PACKAGES.morning]);
                      }
                      setActivePackage('custom'); 
                    }}
                    className={activePackage === 'custom' ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.8rem 0.5rem', fontSize: '0.95rem', borderRadius: '12px', marginBottom: '0.5rem' }}
                  >
                    ✍️ מותאם אישית ({activePackage === 'custom' ? customQuestions.length : getActiveQuestionList().length})
                  </button>
                </div>
              </div>

              {/* Timer Settings Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-light)' }}>⏱️ זמן מענה לכל שאלה:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                  {[15, 30, 45, 60].map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setTimerSetting(time)}
                      className={timerSetting === time ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.65rem', fontSize: '0.95rem', borderRadius: '12px' }}
                    >
                      {time} שניות
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '15px', border: '1px solid rgba(245, 158, 11, 0.15)', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                💡 <strong>טיפ למנחה:</strong> כרגע החדר סגור להצטרפות. תלמידים שינסו להתחבר לחדר <strong>{roomId}</strong> יתבקשו להמתין במסך שלהם עד שתאשר ותפתח את הלובי.
              </div>
            </div>

            {/* Setup Column 2: Edit questions and Launch button */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
              <h2 style={{ fontSize: '1.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 800 }}>
                📝 השאלות במשחק:
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(5, 3, 10, 0.4)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                {/* Scrollable Questions list */}
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                  {getActiveQuestionList().map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '10px',
                        fontSize: '0.95rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', overflow: 'hidden' }}>
                        <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{idx + 1}.</span>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{q.text}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', opacity: 0.7 }}
                        title="מחק שאלה"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new custom question form */}
                <form onSubmit={handleAddQuestion} action="javascript:void(0);" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="הוסיפו שאלה מותאמת אישית..."
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="input-text"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '10px', flex: 1, textAlign: 'right', height: 'auto' }}
                  />
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ 
                      padding: '0.5rem 1rem', 
                      fontSize: '0.9rem', 
                      borderRadius: '10px', 
                      height: 'auto', 
                      boxShadow: 'none',
                      opacity: !newQuestionText.trim() ? 0.6 : 1,
                      pointerEvents: !newQuestionText.trim() ? 'none' : 'auto'
                    }}
                  >
                    <Plus size={16} />
                    <span>הוסף</span>
                  </button>
                </form>
              </div>

              {/* Action Button: open-lobby */}
              <button
                onClick={() => triggerAction('open-lobby', { questions: getActiveQuestionList(), timerSetting })}
                className="btn-accent"
                style={{ width: '100%', padding: '1.25rem', marginTop: '0.5rem', display: 'flex', gap: '0.6rem', justifyContent: 'center', alignItems: 'center' }}
              >
                <Play size={22} style={{ color: 'var(--text-dark)' }} />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>פתיחת החדר והצגת קוד הצטרפות</span>
              </button>
            </div>
            
          </div>
        )}

        {/* 2. LOBBY STATE */}
        {status.status === 'lobby' && (
          <div className="grid-cols-2 animate-pop-in" style={{ width: '100%', gap: '1.5rem' }}>
            {/* Left Box: PIN & QR Join */}
            <div className="glass-panel glowing-yellow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '1.15rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '1px' }}>סרקו והצטרפו למשחק!</span>
              
              {joinUrl && (
                <div style={{ background: '#fff', padding: '1rem', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'inline-block', transition: 'transform 0.3s ease' }} className="podium-stand">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0c0919&bgcolor=ffffff&data=${encodeURIComponent(joinUrl)}`}
                    alt="QR Code to Join"
                    style={{ display: 'block', width: '200px', height: '200px' }}
                  />
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>הקלידו את קוד החדר באתר:</span>
                <span style={{ fontSize: '4.8rem', fontWeight: 900, color: 'var(--accent-yellow)', letterSpacing: '4px', textShadow: '0 0 20px rgba(245,158,11,0.4)', fontFamily: 'monospace' }}>
                  {roomId}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={copyLink} className="btn-secondary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                  {copied ? <CheckCircle size={16} style={{ color: 'var(--accent-green)' }} /> : <Copy size={16} />}
                  <span>{copied ? 'הקישור הועתק!' : 'העתק קישור להצטרפות'}</span>
                </button>
              </div>
            </div>

            {/* Right Box: Connected players list */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 700 }}>
                חברי הכוורת שהצטרפו ({totalPlayers}):
              </h2>
              {totalPlayers === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }} className="animate-pulse-glow">
                  מחכים לשחקן הראשון שייכנס... 💤
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
                  {status.players.map((player, idx) => (
                    <div
                      key={player.id}
                      className="lobby-player-card"
                      style={{ animationDelay: `${(idx % 15) * 0.05}s` }}
                    >
                      <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.25rem' }}>{player.avatar}</span>
                      <span style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{player.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. QUESTION STATE */}
        {status.status === 'question' && (
          <div className="grid-cols-2 animate-pop-in" style={{ width: '100%', gap: '1.5rem' }}>
            {/* Left Box: Active Question Display, Timer and submit progress */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '1.15rem', color: 'var(--accent-yellow)', fontWeight: 600 }}>השאלה הכיתתית:</span>
                <h2 style={{ fontSize: '2.4rem', fontWeight: 800, marginTop: '0.5rem', lineHeight: '1.3', color: '#fff' }}>
                  {status.currentQuestion?.text}
                </h2>
              </div>

              {/* Glowing circular Countdown SVG */}
              <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className={status.timer <= 5 ? 'timer-pulse' : ''}>
                <svg style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }} width="160" height="160">
                  <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke={status.timer <= 6 ? '#ef4444' : status.timer <= 15 ? 'var(--accent-yellow)' : 'var(--accent-purple)'}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * status.timer) / (status.questionTimerSetting || 30)}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                  />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '3.5rem', fontWeight: 900, color: status.timer <= 6 ? '#ef4444' : '#fff', textShadow: status.timer <= 6 ? '0 0 15px rgba(239,68,68,0.6)' : 'none' }}>
                    {status.timer}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>שניות לסיום</span>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem 2rem', borderRadius: '15px' }}>
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>קצב מענה מהניידים:</span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-yellow)', marginTop: '0.25rem' }}>
                  {answeredCount} מתוך {totalPlayers} ענו
                </div>
              </div>
            </div>

            {/* Right Box: Who has answered checklist */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 700 }}>
                מצב המענה בכיתה:
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
                {status.players.map((player) => (
                  <div
                    key={player.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: player.hasAnswered ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: player.hasAnswered ? '1px solid var(--accent-green)' : '1px solid rgba(255, 255, 255, 0.05)',
                      color: player.hasAnswered ? '#a7f3d0' : 'var(--text-muted)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{player.avatar}</span>
                    {player.hasAnswered ? <Check size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} /> : null}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.nickname}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. RESULTS STATE (Graph + Detailed Answers Reveal) */}
        {status.status === 'results' && (
          <div className="grid-cols-2 animate-pop-in" style={{ width: '100%', gap: '1.5rem' }}>
            
            {/* Left Box: Animated ChartJS graph */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '1rem', fontWeight: 700 }}>
                התשובות הפופולריות ביותר (דעת הכוורת):
              </h2>
              {answeredCount === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  אף תלמיד לא ענה בסיבוב הזה.
                </div>
              ) : (
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', minHeight: '280px' }}>
                  <Bar
                    data={getChartData()}
                    options={{
                      indexAxis: 'y' as const, // Horizontal Bar
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          titleFont: { family: 'Rubik' },
                          bodyFont: { family: 'Rubik' }
                        }
                      },
                      scales: {
                        x: {
                          ticks: { color: '#9ca3af', font: { family: 'Rubik' }, stepSize: 1 },
                          grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        y: {
                          ticks: { color: '#f3f4f6', font: { family: 'Rubik', size: 14, weight: 'bold' } },
                          grid: { display: false }
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Right Box: Detailed answer disclosure & top players */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 700 }}>
                מי ענה מה? 👀
              </h2>
              {answeredCount === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  אין נתונים להצגה
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '350px', overflowY: 'auto', paddingLeft: '0.25rem' }}>
                  {getDisclosedGroupedAnswers().map((group, index) => (
                    <div 
                      key={group.display} 
                      className="animate-pop-in"
                      style={{ 
                        background: index === 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', 
                        border: index === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '14px', 
                        padding: '0.8rem 1rem' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: index === 0 ? 'var(--accent-yellow)' : '#fff' }}>"{group.display}"</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{group.count} מצביעים ({Math.round(group.count/answeredCount * 100)}%)</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {group.players.map(p => (
                          <span key={p.nickname} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.2rem 0.55rem', borderRadius: '20px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{p.avatar}</span>
                            <span style={{ fontWeight: 500 }}>{p.nickname}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Temporary leaderboard in results */}
              <h3 style={{ fontSize: '1.15rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', fontWeight: 700 }}>מובילים כרגע:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {status.players.slice(0, 5).map((player, idx) => (
                  <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', background: 'rgba(255,255,255,0.01)', padding: '0.4rem 0.75rem', borderRadius: '10px' }}>
                    <span style={{ display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>#{idx+1}</span>
                      <span>{player.avatar}</span>
                      <span style={{ fontWeight: 600 }}>{player.nickname}</span>
                    </span>
                    <span><strong>{player.score}</strong> נק׳</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. GAMEOVER STATE (3D Podium + Final Scores) */}
        {status.status === 'gameover' && (
          <div className="grid-cols-2 animate-pop-in" style={{ width: '100%', gap: '1.5rem' }}>
            
            {/* Left Box: 3D-styled Victory Podium */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-yellow)', textShadow: '0 0 10px rgba(245,158,11,0.2)' }}>
                מנצחי המוח הכוורתי! 🏆
              </h2>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1.5rem', width: '100%', maxWidth: '400px', height: '290px', marginTop: '1.5rem' }}>
                
                {/* 2nd Place (Left) */}
                {status.players[1] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }} className="podium-stand">
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{status.players[1].avatar}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      🥈 {status.players[1].nickname}
                    </span>
                    <div style={{ width: '100%', height: '130px', background: 'linear-gradient(0deg, rgba(255,255,255,0.03) 0%, rgba(200,200,200,0.15) 100%)', border: '1px solid rgba(200,200,200,0.3)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 -4px 15px rgba(200,200,200,0.05)' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#e5e7eb' }}>2</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{status.players[1].score} נק׳</span>
                    </div>
                  </div>
                )}

                {/* 1st Place (Center) */}
                {status.players[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }} className="podium-stand">
                    <span style={{ fontSize: '3rem', marginBottom: '0.25rem', animation: 'bounce 1.5s infinite alternate ease-in-out' }}>{status.players[0].avatar}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center', color: 'var(--accent-yellow)' }}>
                      👑 {status.players[0].nickname}
                    </span>
                    <div style={{ width: '100%', height: '170px', background: 'linear-gradient(0deg, rgba(255,255,255,0.03) 0%, rgba(245,158,11,0.2) 100%)', border: '2px solid rgba(245,158,11,0.5)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 -4px 20px rgba(245,158,11,0.15)' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-yellow)' }}>1</span>
                      <span style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 'bold', marginTop: '0.25rem' }}>{status.players[0].score} נק׳</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place (Right) */}
                {status.players[2] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }} className="podium-stand">
                    <span style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>{status.players[2].avatar}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      🥉 {status.players[2].nickname}
                    </span>
                    <div style={{ width: '100%', height: '90px', background: 'linear-gradient(0deg, rgba(255,255,255,0.03) 0%, rgba(217,119,6,0.15) 100%)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 -4px 15px rgba(217,119,6,0.05)' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>3</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{status.players[2].score} נק׳</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right Box: Full final leaderboard list */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.45rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', fontWeight: 700 }}>
                טבלת דירוג סופית:
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {status.players.map((player, index) => (
                  <div
                    key={player.id}
                    className="animate-pop-in"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-muted)', width: '24px' }}>#{index + 1}</strong>
                      <span style={{ fontSize: '1.3rem' }}>{player.avatar}</span>
                      <span>{player.nickname}</span>
                    </span>
                    <span><strong style={{ color: 'var(--accent-purple)' }}>{player.score}</strong> נקודות</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom controls panel */}
      <footer className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 30px rgba(0,0,0,0.2)' }}>
        
        {/* Left side: Soundboard triggers for Host */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1.25rem', marginLeft: '0.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>סאונדבורד:</span>
          <button onClick={() => { sounds.playBuzzer(); }} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px', backdropFilter: 'none' }} title="השמע באזר">🚨 באזר</button>
          <button onClick={() => { sounds.playJoin(); }} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px', backdropFilter: 'none' }} title="השמע כניסה">🔔 כניסה</button>
          <button onClick={() => { sounds.playReveal(); }} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px', backdropFilter: 'none' }} title="השמע גילוי">🌟 גילוי</button>
          <button onClick={() => { sounds.playVictory(); }} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderRadius: '10px', backdropFilter: 'none' }} title="השמע כפיים">👏 כפיים</button>
        </div>

        {/* Right side: Host Controls based on state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Setup controls */}
          {status.status === 'setup' && (
            <div style={{ color: 'var(--text-muted)' }}>
              ממתינים לקביעת הגדרות המשחק על ידך...
            </div>
          )}

          {/* Lobby controls */}
          {status.status === 'lobby' && (
            <>
              <div style={{ color: 'var(--text-muted)' }}>
                ממתינים שכולם ייכנסו. לחצו על הכפתור כדי להתחיל...
              </div>
              <button
                onClick={() => triggerAction('start')}
                className="btn-accent"
                disabled={totalPlayers === 0}
                style={{ padding: '0.8rem 1.8rem' }}
              >
                <Play size={18} style={{ color: 'var(--text-dark)' }} />
                <span style={{ color: 'var(--text-dark)' }}>התחל משחק ({totalPlayers} שחקנים)</span>
              </button>
            </>
          )}

          {/* Question controls */}
          {status.status === 'question' && (
            <>
              <div style={{ color: 'var(--text-muted)' }}>
                ענו {answeredCount} מתוך {totalPlayers} תלמידים.
              </div>
              <button
                onClick={() => triggerAction('reveal')}
                className="btn-primary"
                style={{ padding: '0.8rem 1.8rem' }}
              >
                <SkipForward size={18} />
                <span>חשיפת תוצאות הסיבוב</span>
              </button>
            </>
          )}

          {/* Results controls */}
          {status.status === 'results' && (
            <>
              <div style={{ color: 'var(--text-muted)' }}>
                שאלה {status.currentQuestionIndex + 1} מתוך {status.totalQuestions} הסתיימה.
              </div>
              <button
                onClick={() => triggerAction('next')}
                className="btn-accent"
                style={{ padding: '0.8rem 1.8rem' }}
              >
                <span style={{ color: 'var(--text-dark)' }}>{status.currentQuestionIndex + 1 < status.totalQuestions ? 'שאלה הבאה' : 'סיום והצגת מנצחים'}</span>
                <SkipForward size={18} style={{ color: 'var(--text-dark)' }} />
              </button>
            </>
          )}

          {/* Gameover controls */}
          {status.status === 'gameover' && (
            <>
              <div style={{ color: 'var(--text-muted)' }}>
                המשחק הסתיים בהצלחה! רוצים להריץ משחק חדש?
              </div>
              <button
                onClick={() => triggerAction('restart')}
                className="btn-primary"
                style={{ padding: '0.8rem 1.8rem' }}
              >
                <RotateCcw size={18} />
                <span>הפעלה מחדש (הגדרות חדשות)</span>
              </button>
            </>
          )}
        </div>

      </footer>
    </div>
  );
}
