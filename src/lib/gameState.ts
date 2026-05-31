import { Question, getRandomQuestions } from './questions';
import { kv } from '@vercel/kv';

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  lastAnswer: string | null;
  lastScoreAdded: number;
  joinedAt: number;
}

export interface Reaction {
  id: string;
  emoji: string;
  timestamp: number;
  nickname: string;
}

export interface Session {
  id: string; // 4-digit Room PIN
  status: 'setup' | 'lobby' | 'question' | 'results' | 'gameover';
  currentQuestionIndex: number;
  timer: number;
  questionTimerSetting?: number;
  questions: Question[];
  players: Player[];
  reactions?: Reaction[];
  createdAt: number;
  lastActiveAt: number;
}

declare global {
  var globalGameState: {
    sessions: Record<string, Session>;
  } | undefined;
}

// In-Memory store fallback
if (!globalThis.globalGameState) {
  globalThis.globalGameState = {
    sessions: {},
  };
}

const sessions = globalThis.globalGameState.sessions;

// Helper to determine if Vercel KV (Redis) is configured
const isKvEnabled = (): boolean => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// Database persistence helpers
async function saveSessionToStore(session: Session) {
  if (isKvEnabled()) {
    // Save to Vercel KV with a 3-hour expiration (10800 seconds)
    await kv.set(`hivemind:session:${session.id}`, session, { ex: 10800 });
  } else {
    sessions[session.id] = session;
  }
}

async function getSessionFromStore(id: string): Promise<Session | null> {
  if (isKvEnabled()) {
    try {
      const session = await kv.get<Session>(`hivemind:session:${id}`);
      return session || null;
    } catch (e) {
      console.error('Vercel KV Read Error, using local fallback:', e);
      return sessions[id] || null;
    }
  } else {
    return sessions[id] || null;
  }
}

// Helper to generate a unique 4-digit PIN
async function generateRoomId(): Promise<string> {
  let pin = '';
  let exists = true;
  while (exists) {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    const existing = await getSessionFromStore(pin);
    exists = !!existing;
  }
  return pin;
}

// Clean up old in-memory sessions (older than 2 hours)
function cleanupSessions() {
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  Object.keys(sessions).forEach(id => {
    if (now - sessions[id].lastActiveAt > twoHours) {
      delete sessions[id];
    }
  });
}

export function normalizeAnswer(ans: string): string {
  if (!ans) return '';
  return ans
    .trim()
    .replace(/\s+/g, ' ') // replace multiple spaces with single space
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '') // remove punctuation
    .toLowerCase();
}

export async function createSession(questionCount: number = 5, customQuestions?: Question[]): Promise<Session> {
  if (!isKvEnabled()) {
    cleanupSessions();
  }
  const id = await generateRoomId();
  const session: Session = {
    id,
    status: 'setup', // Start in setup state
    currentQuestionIndex: 0,
    timer: 30, // 30 seconds default per question
    questionTimerSetting: 30,
    questions: customQuestions && customQuestions.length > 0 ? customQuestions : getRandomQuestions(questionCount),
    players: [],
    reactions: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  await saveSessionToStore(session);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const session = await getSessionFromStore(id);
  if (session) {
    session.lastActiveAt = Date.now();
    // Clean old reactions (older than 4 seconds)
    if (session.reactions) {
      const now = Date.now();
      session.reactions = session.reactions.filter(r => now - r.timestamp < 4000);
    }
    await saveSessionToStore(session);
    return session;
  }
  return null;
}

export async function joinSession(roomId: string, nickname: string, avatar: string = '🐝'): Promise<{ playerId: string; session: Session } | null> {
  const session = await getSession(roomId);
  if (!session || session.status !== 'lobby') return null;

  // Clean nickname
  const cleanNickname = nickname.trim().slice(0, 15);
  if (!cleanNickname) return null;

  // Check if player name already exists in this room
  const existing = session.players.find(p => p.nickname === cleanNickname);
  if (existing) {
    return { playerId: existing.id, session };
  }

  const playerId = Math.random().toString(36).substring(2, 9);
  const player: Player = {
    id: playerId,
    nickname: cleanNickname,
    avatar: avatar.trim() || '🐝',
    score: 0,
    lastAnswer: null,
    lastScoreAdded: 0,
    joinedAt: Date.now(),
  };

  session.players.push(player);
  await saveSessionToStore(session);
  return { playerId, session };
}

export async function submitAnswer(roomId: string, playerId: string, answer: string): Promise<boolean> {
  const session = await getSession(roomId);
  if (!session || session.status !== 'question') return false;

  const player = session.players.find(p => p.id === playerId);
  if (!player) return false;

  player.lastAnswer = answer.trim().slice(0, 50); // limit answer to 50 chars
  await saveSessionToStore(session);
  return true;
}

export async function addReaction(roomId: string, emoji: string, nickname: string): Promise<boolean> {
  const session = await getSession(roomId);
  if (!session) return false;

  if (!session.reactions) {
    session.reactions = [];
  }

  session.reactions.push({
    id: Math.random().toString(36).substring(2, 9),
    emoji: emoji.slice(0, 5),
    timestamp: Date.now(),
    nickname: nickname.trim().slice(0, 15)
  });

  await saveSessionToStore(session);
  return true;
}

export function processRoundScores(session: Session) {
  const currentQuestion = session.questions[session.currentQuestionIndex];
  if (!currentQuestion) return;

  const activePlayers = session.players;
  const answeredPlayers = activePlayers.filter(p => p.lastAnswer !== null);

  if (answeredPlayers.length === 0) {
    // No one answered
    activePlayers.forEach(p => {
      p.lastScoreAdded = 0;
    });
    return;
  }

  // Count frequencies of normalized answers
  const counts: Record<string, number> = {};
  answeredPlayers.forEach(p => {
    const norm = normalizeAnswer(p.lastAnswer as string);
    counts[norm] = (counts[norm] || 0) + 1;
  });

  const totalAnswered = answeredPlayers.length;

  // Update scores
  activePlayers.forEach(player => {
    if (player.lastAnswer === null) {
      player.lastScoreAdded = 0;
      return;
    }

    const norm = normalizeAnswer(player.lastAnswer);
    const count = counts[norm] || 0;
    
    // Hivemind score: percentage of players who wrote the same normalized answer
    // Max 100 points per round
    const pointsGained = Math.round((count / totalAnswered) * 100);
    player.score += pointsGained;
    player.lastScoreAdded = pointsGained;
  });

  // Sort players by total score
  session.players.sort((a, b) => b.score - a.score);
}

export async function handleHostAction(roomId: string, action: string, payload?: any): Promise<Session | null> {
  const session = await getSession(roomId);
  if (!session) return null;

  switch (action) {
    case 'tick':
      if (session.status === 'question') {
        if (session.timer > 0) {
          session.timer -= 1;
        }
        // Auto-reveal if timer hits 0
        if (session.timer === 0) {
          session.status = 'results';
          processRoundScores(session);
        }
      }
      break;

    case 'open-lobby':
      if (session.status === 'setup') {
        session.status = 'lobby';
        if (payload) {
          if (payload.questions && Array.isArray(payload.questions)) {
            session.questions = payload.questions;
          }
          if (payload.timerSetting) {
            session.questionTimerSetting = payload.timerSetting;
            session.timer = payload.timerSetting;
          }
        }
      }
      break;

    case 'start':
      if (session.status === 'lobby') {
        session.status = 'question';
        session.currentQuestionIndex = 0;
        session.timer = session.questionTimerSetting || 30;
        // Reset player answers
        session.players.forEach(p => {
          p.lastAnswer = null;
          p.lastScoreAdded = 0;
          p.score = 0;
        });
      }
      break;

    case 'reveal':
      if (session.status === 'question') {
        session.status = 'results';
        processRoundScores(session);
      }
      break;

    case 'next':
      if (session.status === 'results') {
        if (session.currentQuestionIndex + 1 < session.questions.length) {
          session.currentQuestionIndex += 1;
          session.status = 'question';
          session.timer = session.questionTimerSetting || 30;
          // Reset answers for the new round
          session.players.forEach(p => {
            p.lastAnswer = null;
            p.lastScoreAdded = 0;
          });
        } else {
          session.status = 'gameover';
        }
      }
      break;

    case 'end':
      session.status = 'gameover';
      break;

    case 'restart':
      session.status = 'setup'; // Go back to setup so host can re-adjust questions/timer
      session.currentQuestionIndex = 0;
      session.players.forEach(p => {
        p.score = 0;
        p.lastAnswer = null;
        p.lastScoreAdded = 0;
      });
      // Get new random questions
      session.questions = getRandomQuestions(5);
      break;
  }

  await saveSessionToStore(session);
  return session;
}
