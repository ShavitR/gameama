import { NextResponse } from 'next/server';
import { getSession } from '@/lib/gameState';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const playerId = searchParams.get('playerId');

    if (!roomId) {
      return NextResponse.json({ success: false, error: 'חסר מזהה חדר' }, { status: 400 });
    }

    const session = await getSession(roomId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'החדר לא נמצא' }, { status: 404 });
    }

    // Filter players list to prevent cheating
    const filteredPlayers = session.players.map(p => {
      const hasAnswered = p.lastAnswer !== null;
      
      // If it is a question phase, do not expose answers to anyone except their own
      if (session.status === 'question') {
        return {
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          lastScoreAdded: p.lastScoreAdded,
          hasAnswered,
          lastAnswer: p.id === playerId ? p.lastAnswer : null
        };
      }

      // In other phases (lobby, results, gameover), it is safe to show all answers
      return {
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        lastScoreAdded: p.lastScoreAdded,
        hasAnswered,
        lastAnswer: p.lastAnswer
      };
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        timer: session.timer,
        questions: session.status === 'lobby' ? [] : session.questions,
        currentQuestion: session.questions[session.currentQuestionIndex] || null,
        players: filteredPlayers,
        reactions: session.reactions || [],
        totalQuestions: session.questions.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
