'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, LogIn, Settings, Sparkles } from 'lucide-react';

const AVATARS = ['🦁', '🐼', '🐙', '🦊', '🐨', '🦖', '🦄', '🐸', '🐝', '🐯', '🐒', '🦉', '🐹', '🐥', '🐧', '🦈'];

export default function Home() {
  const router = useRouter();

  // Student States
  const [roomId, setRoomId] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🐝');
  const [studentError, setStudentError] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Teacher / Host States
  const [teacherError, setTeacherError] = useState('');
  const [teacherLoading, setTeacherLoading] = useState(false);

  // Pre-fill Room ID from URL query parameters (e.g. from scanned QR code)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const searchParams = new URLSearchParams(window.location.search || '');
        const queryRoomId = searchParams.get('roomId');
        if (queryRoomId) {
          setRoomId(queryRoomId);
        }
      }
    } catch (e) {
      console.warn("Failed to parse URL query parameters:", e);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  // Join as Student
  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (studentLoading) return;
    setStudentError('');

    const trimmedRoom = roomId.trim();
    const trimmedNick = nickname.trim();

    if (!trimmedRoom || trimmedRoom.length !== 4 || isNaN(Number(trimmedRoom))) {
      setStudentError('נא להזין קוד חדר תקין בן 4 ספרות');
      return;
    }

    if (!trimmedNick) {
      setStudentError('נא להזין כינוי');
      return;
    }

    setStudentLoading(true);

    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId: trimmedRoom, 
          nickname: trimmedNick,
          avatar: selectedAvatar
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStudentError(data.error || 'שגיאה בחיבור לחדר');
        setStudentLoading(false);
      } else {
        // Save credentials to localStorage (safely wrapped)
        try {
          localStorage.setItem(`hivemind_player_${trimmedRoom}`, data.playerId);
          localStorage.setItem(`hivemind_nick_${trimmedRoom}`, trimmedNick);
          localStorage.setItem(`hivemind_avatar_${trimmedRoom}`, selectedAvatar);
        } catch (storageErr) {
          console.warn('LocalStorage is blocked or disabled:', storageErr);
        }
        
        // Pass credentials in the query params to ensure it works even if localStorage fails
        router.push(`/player/${trimmedRoom}?playerId=${data.playerId}&nick=${encodeURIComponent(trimmedNick)}&avatar=${encodeURIComponent(selectedAvatar)}`);
      }
    } catch (err) {
      setStudentError('שגיאת רשת. בדקו את החיבור לאינטרנט.');
      setStudentLoading(false);
    }
  };

  // Create as Teacher (Host)
  const handleCreate = async () => {
    setTeacherError('');
    setTeacherLoading(true);

    try {
      const res = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setTeacherError(data.error || 'שגיאה ביצירת המשחק');
        setTeacherLoading(false);
      } else {
        router.push(`/host/${data.session.id}`);
      }
    } catch (err) {
      setTeacherError('שגיאת שרת. נסו שוב מאוחר יותר.');
      setTeacherLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      
      {/* Decorative Shifting Header */}
      <header className="brand-header">
        <div className="bee-emoji" style={{ fontSize: '5rem', marginBottom: '0.75rem', filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.5))' }}>🐝</div>
        <h1 className="brand-title">המוח הכוורתי</h1>
        <p className="brand-subtitle" style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0.75rem auto 0 auto', lineHeight: '1.5' }}>
          משחק פתיחת בוקר כיתתי קצבי ומשעשע. נחשו מה רוב הכיתה תענה על השאלות וצברו נקודות!
        </p>
      </header>

      <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="grid-cols-2" style={{ width: '100%', maxWidth: '1050px' }}>
          
          {/* Student Entrance Panel */}
          <section className="glass-panel glowing-yellow" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <Users size={28} style={{ color: 'var(--accent-yellow)', filter: 'drop-shadow(0 0 8px var(--accent-yellow-glow))' }} />
              <h2 style={{ fontSize: '1.7rem', fontWeight: 800 }}>הצטרפות תלמיד</h2>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
              הקלידו את קוד החדר שמופיע על הלוח בכיתה, בחרו דמות מגניבה לכוורת, והזינו את הכינוי שלכם!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} suppressHydrationWarning>
              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-light)' }}>קוד חדר (4 ספרות)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="לדוגמה: 1234"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={handleKeyDown}
                  className="input-text"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="numeric"
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-light)' }}>הכינוי שלך</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="הכניסו שם מגניב..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="input-text"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.6rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-light)' }}>בחרו דמות כוורת (אוואטר)</label>
                <div className="avatar-grid">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      style={{
                        fontSize: '1.6rem',
                        background: selectedAvatar === emoji ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        border: selectedAvatar === emoji ? '2px solid var(--accent-yellow)' : '2px solid transparent',
                        borderRadius: '12px',
                        padding: '0.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        transform: selectedAvatar === emoji ? 'scale(1.15) translateY(-2px)' : 'none'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {studentError && (
                <div className="animate-pop-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.85rem', borderRadius: '14px', color: '#fca5a5', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚠️</span>
                  <span>{studentError}</span>
                </div>
              )}

              <button 
                type="button" 
                onClick={() => handleJoin()}
                className="btn-accent" 
                style={{ 
                  width: '100%', 
                  padding: '1.1rem',
                  opacity: studentLoading ? 0.6 : 1,
                  pointerEvents: studentLoading ? 'none' : 'auto'
                }}
              >
                {studentLoading ? 'מתחבר לכוורת...' : (
                  <>
                    <LogIn size={20} />
                    <span>להצטרפות למשחק</span>
                  </>
                )}
              </button>
              {mounted ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', textAlign: 'center', marginTop: '0.5rem', opacity: 0.8 }}>
                  ● הכוורת פעילה (v1.0.3)
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-pink)', textAlign: 'center', marginTop: '0.5rem', opacity: 0.8 }} className="animate-pulse-glow">
                  טוען חיבור לקליינט...
                </div>
              )}
            </div>
          </section>

          {/* Teacher Creation Panel */}
          <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignSelf: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <Settings size={28} style={{ color: 'var(--accent-purple)', filter: 'drop-shadow(0 0 8px var(--accent-purple-glow))' }} />
              <h2 style={{ fontSize: '1.7rem', fontWeight: 800 }}>יצירת משחק (מורה)</h2>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
              לחצו על הכפתור כדי לפתוח חדר משחק חדש. את הגדרות המשחק והשאלות תוכלו לקבוע במסך המארח שיפתח, לפני שהתלמידים יצטרפו!
            </p>

            {teacherError && (
              <div className="animate-pop-in" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.85rem', borderRadius: '14px', color: '#fca5a5', fontSize: '0.95rem' }}>
                {teacherError}
              </div>
            )}

            <button onClick={handleCreate} className="btn-primary" disabled={teacherLoading} style={{ width: '100%', padding: '1.1rem', marginTop: '0.5rem' }}>
              {teacherLoading ? 'מייצר חדר משחק...' : (
                <>
                  <Sparkles size={20} style={{ color: 'var(--accent-yellow)' }} />
                  <span>יצירת חדר משחק חדש</span>
                </>
              )}
            </button>
          </section>

        </div>
      </main>

      <footer style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '3rem', zIndex: 1 }}>
        המוח הכוורתי 🐝 נבנה באהבה עבור פתיחת יום מהנה, קלילה ומגבשת בכיתה
      </footer>
    </div>
  );
}
