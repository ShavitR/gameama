'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Clock, User, Award, CheckCircle, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { sounds } from '@/lib/sounds';

interface PlayerData {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  lastAnswer: string | null;
  lastScoreAdded: number;
  hasAnswered: boolean;
}

interface GameStatus {
  id: string;
  status: 'setup' | 'lobby' | 'question' | 'results' | 'gameover';
  currentQuestionIndex: number;
  timer: number;
  currentQuestion: { id: string; text: string } | null;
  players: PlayerData[];
  totalQuestions: number;
}

const REACTION_EMOJIS = ['😂', '🤔', '🐝', '🎉', '🔥', '👏', '😱', '💔'];

export default function PlayerScreen() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [avatar, setAvatar] = useState<string>('🐝');
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [muted, setMuted] = useState(false);
  
  // To avoid reloading loop issues
  const initialized = useRef(false);

  // 1. Retrieve playerId, nickname, and avatar from localStorage
  useEffect(() => {
    if (!roomId || roomId === '[roomId]' || roomId.startsWith('[')) return;
    if (initialized.current) return;
    initialized.current = true;

    const storedPlayerId = localStorage.getItem(`hivemind_player_${roomId}`);
    const storedNick = localStorage.getItem(`hivemind_nick_${roomId}`);
    const storedAvatar = localStorage.getItem(`hivemind_avatar_${roomId}`);

    if (!storedPlayerId || !storedNick) {
      router.replace('/');
    } else {
      setPlayerId(storedPlayerId);
      setNickname(storedNick);
      if (storedAvatar) {
        setAvatar(storedAvatar);
      }
    }
    setMuted(sounds.isMuted);
  }, [roomId, router]);

  // 2. Poll Game Status every 1.5 seconds
  useEffect(() => {
    if (!playerId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/game/status?roomId=${roomId}&playerId=${playerId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setErrorMsg('החדר נסגר או לא קיים');
            return;
          }
          throw new Error('שגיאה בטעינת הנתונים');
        }
        const data = await res.json();
        if (data.success) {
          setStatus(data.session);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    fetchStatus(); // initial fetch
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, [roomId, playerId]);

  // 3. Handle answer submission
  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerInput.trim() || submitting || !playerId) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/game/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId,
          answer: answerInput.trim()
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'שגיאה בשליחת התשובה');
      } else {
        sounds.playSubmit();
      }
    } catch (err) {
      setErrorMsg('שגיאת רשת בשליחת התשובה');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Send a live emoji reaction
  const sendReaction = async (emoji: string) => {
    if (!playerId) return;
    try {
      sounds.playSubmit(); // Local feedback sound
      await fetch('/api/game/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          playerId,
          emoji
        })
      });
    } catch (err) {
      console.error('Reaction sending error:', err);
    }
  };

  const toggleMute = () => {
    sounds.isMuted = !sounds.isMuted;
    setMuted(sounds.isMuted);
  };

  // Reset local answer input when moving back to a new question round
  useEffect(() => {
    if (status?.status === 'question') {
      const self = status.players.find(p => p.id === playerId);
      if (!self?.hasAnswered) {
        setAnswerInput('');
      }
    }
  }, [status?.currentQuestionIndex, status?.status, playerId]);

  if (errorMsg) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2>אופס! נתקלנו בשגיאה</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem 0' }}>{errorMsg}</p>
          <button onClick={() => router.push('/')} className="btn-primary">חזרה למסך הבית</button>
        </div>
      </div>
    );
  }

  if (!status || !playerId) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-pulse-glow" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-purple)', margin: '0 auto 1.5rem auto' }}></div>
          <h2>מתחבר לכוורת... 🐝</h2>
        </div>
      </div>
    );
  }

  // Find self player state
  const self = status.players.find(p => p.id === playerId);
  const totalPlayers = status.players.length;
  const selfRank = status.players.findIndex(p => p.id === playerId) + 1;

  // Render based on room status
  return (
    <div className="container" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, justifyContent: 'center', paddingBottom: '6rem' }}>
      
      {/* Header bar showing Player Name, Avatar, Mute toggle, and current Score */}
      <header className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.6rem' }}>{avatar}</span>
          <span style={{ fontWeight: 600 }}>{nickname}</span>
          <button 
            onClick={toggleMute} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center', marginRight: '0.25rem' }}
            title={muted ? 'בטל השתקה' : 'השתק צלילים'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={20} style={{ color: 'var(--accent-purple)' }} />
          <span>ניקוד: <strong style={{ color: 'var(--accent-purple)' }}>{self?.score || 0}</strong></span>
        </div>
      </header>

      {/* 1. SETUP STATE */}
      {status.status === 'setup' && (
        <main className="glass-panel glowing-yellow animate-pop-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4.5rem', animation: 'beeFlap 0.8s infinite alternate ease-in-out', display: 'inline-block', margin: '0 auto' }}>🐝</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>החדר מוגדר כעת!</h2>
          <p style={{ color: 'var(--text-muted)' }}>קוד החדר: <strong>{roomId}</strong></p>
          <div style={{ margin: '1rem 0', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px dashed var(--panel-border)' }}>
            <p style={{ fontSize: '1.05rem', fontWeight: 500 }} className="animate-pulse-glow">
              המורה מגדיר כעת את השאלות בלוח הראשי.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              ברגע שהמורה יפתח את החדר להצטרפות, הלובי ייפתח באופן אוטומטי ותוכלו לראות מי עוד מצטרף. נא להמתין...
            </p>
          </div>
        </main>
      )}

      {/* 2. LOBBY STATE */}
      {status.status === 'lobby' && (
        <main className="glass-panel glowing-yellow animate-pop-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', animation: 'bounce 2s infinite ease-in-out', display: 'inline-block', width: 'fit-content', margin: '0 auto' }}>🐝</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>נכנסת ללובי!</h2>
          <p style={{ color: 'var(--text-muted)' }}>קוד החדר: <strong>{roomId}</strong></p>
          <div style={{ margin: '1rem 0', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px dashed var(--panel-border)' }}>
            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>שחקנים מחוברים כרגע:</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-yellow)' }}>{totalPlayers}</span>
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 500 }} className="animate-pulse-glow">
            מחזיקים אצבעות! ממתינים שהמורה יתחיל את המשחק...
          </p>
        </main>
      )}

      {/* 3. QUESTION STATE */}
      {status.status === 'question' && (
        <main className="glass-panel animate-pop-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Question Header & Timer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              שאלה {status.currentQuestionIndex + 1} מתוך {status.totalQuestions}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: status.timer <= 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: status.timer <= 10 ? '1px solid #ef4444' : '1px solid var(--panel-border)', color: status.timer <= 10 ? '#fca5a5' : 'inherit' }}>
              <Clock size={16} />
              <span style={{ fontWeight: 'bold' }}>{status.timer}ש׳</span>
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.4, color: 'var(--text-light)', textAlign: 'center', margin: '0.5rem 0' }}>
            {status.currentQuestion?.text}
          </h2>

          {/* Form / Submitted Status */}
          {self?.hasAnswered ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <CheckCircle size={56} style={{ color: 'var(--accent-green)', filter: 'drop-shadow(0 0 10px var(--accent-green-glow))' }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>התשובה נשלחה בהצלחה!</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                הקלדת: <strong style={{ color: '#fff', fontSize: '1.1rem' }}>"{self.lastAnswer}"</strong>
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.95rem', color: 'var(--text-muted)' }} className="animate-pulse-glow">
                מחכים לשאר התלמידים (ענו {status.players.filter(p => p.hasAnswered).length} מתוך {totalPlayers})...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} suppressHydrationWarning>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.95rem' }}>הניחוש שלכם (מה הרוב יגידו?):</label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="כתבו תשובה קצרה וקולעת..."
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  className="input-text"
                  autoFocus
                  required
                  suppressHydrationWarning
                />
              </div>

              <button type="submit" className="btn-accent" disabled={submitting || !answerInput.trim()} style={{ width: '100%' }}>
                {submitting ? 'שולח...' : (
                  <>
                    <Send size={18} style={{ transform: 'rotate(180deg)' }} />
                    <span>שלח תשובה לכוורת</span>
                  </>
                )}
              </button>
            </form>
          )}
        </main>
      )}

      {/* 4. RESULTS STATE */}
      {status.status === 'results' && (
        <main className="glass-panel glowing-yellow animate-pop-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2.5rem 1.5rem' }}>
          
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>סיכום שאלה {status.currentQuestionIndex + 1}</span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginTop: '0.25rem' }}>{status.currentQuestion?.text}</h3>
          </div>

          {self?.lastAnswer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '15px', border: '1px solid var(--panel-border)', width: '100%' }}>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>התשובה שלך:</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.25rem 0' }}>"{self.lastAnswer}"</p>
              </div>

              {/* Feedbacks based on score added */}
              {self.lastScoreAdded > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '3rem', animation: 'bounce 1s infinite' }}>🐝</div>
                  <h3 style={{ color: 'var(--accent-green)', fontSize: '1.5rem', fontWeight: 700 }}>
                    קיבלת +{self.lastScoreAdded} נקודות!
                  </h3>
                  {self.lastScoreAdded >= 50 ? (
                    <p style={{ fontWeight: 500, color: 'var(--accent-yellow)' }}>חשבתם בדיוק כמו הרוב! אתם מחוברים לכוורת! 🧠</p>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>חלק מהכיתה הסכימו אתכם. קיבלתם קצת נקודות!</p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '3rem' }}>👽</div>
                  <h3 style={{ color: 'var(--accent-pink)', fontSize: '1.5rem', fontWeight: 700 }}>
                    קיבלת 0 נקודות בסיבוב הזה
                  </h3>
                  <p style={{ color: 'var(--text-muted)' }}>אף אחד אחר בכיתה לא כתב את התשובה הזו... אתם ייחודיים!</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '1.5rem' }}>
              <HelpCircle size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>לא ענית בסיבוב הזה!</h3>
              <p style={{ color: 'var(--text-muted)' }}>חבל, בסיבוב הבא כדאי להזדרז ולענות לפני שהטיימר נגמר.</p>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-around' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>מיקום כרגע:</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--accent-yellow)' }}>{selfRank} מתוך {totalPlayers}</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ניקוד כולל:</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--accent-purple)' }}>{self?.score || 0}</strong>
            </div>
          </div>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '1rem' }} className="animate-pulse-glow">
            הסתכלו על המסך הראשי לראות את הגרף! ממתינים לשאלה הבאה...
          </p>
        </main>
      )}

      {/* 5. GAMEOVER STATE */}
      {status.status === 'gameover' && (
        <main className="glass-panel animate-pop-in" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4.5rem' }}>🏆</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900 }}>המשחק הסתיים!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>סיימנו את כל השאלות של חשיבה קבוצתית.</p>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '15px', border: '1px solid var(--panel-border)', margin: '1rem 0' }}>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>המיקום הסופי שלך:</span>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-yellow)' }}>מקום {selfRank}</span>
            <span style={{ display: 'block', fontSize: '1.1rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>מתוך {totalPlayers} שחקנים</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>ניקוד סופי:</span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--accent-purple)' }}>{self?.score || 0} נקודות</strong>
            </div>
          </div>

          <button onClick={() => router.push('/')} className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
            חזרה לדף הבית
          </button>
        </main>
      )}

      {/* Live Floating Reaction Bar */}
      <div style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--panel-bg)',
        border: '1px solid var(--panel-border)',
        backdropFilter: 'blur(15px)',
        padding: '0.5rem 1rem',
        borderRadius: '30px',
        display: 'flex',
        gap: '0.6rem',
        boxShadow: 'var(--shadow-md)',
        zIndex: 100,
        width: '90%',
        maxWidth: '450px',
        justifyContent: 'space-around',
        direction: 'ltr' // Emojis ordered ltr
      }}>
        {REACTION_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.7rem',
              cursor: 'pointer',
              padding: '0.25rem',
              transition: 'transform 0.15s ease',
              outline: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none'
            }}
            className="reaction-btn"
          >
            {emoji}
          </button>
        ))}
      </div>

    </div>
  );
}
