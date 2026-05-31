import { NextResponse } from 'next/server';
import { joinSession, getSession } from '@/lib/gameState';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, nickname, avatar } = body;
    
    if (!roomId || !nickname) {
      return NextResponse.json({ success: false, error: 'נא להזין קוד חדר וכינוי' }, { status: 400 });
    }

    const session = await getSession(roomId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'החדר המבוקש לא קיים' }, { status: 404 });
    }

    if (session.status === 'setup') {
      return NextResponse.json({ 
        success: false, 
        error: 'המורה עדיין מגדיר את המשחק בלוח. נא להמתין לפתיחת הלובי!' 
      }, { status: 400 });
    }

    if (session.status !== 'lobby') {
      return NextResponse.json({ 
        success: false, 
        error: 'לא ניתן להצטרף לחדר זה. המשחק כבר התחיל או הסתיים.' 
      }, { status: 400 });
    }

    const result = await joinSession(roomId, nickname, avatar);
    if (!result) {
      return NextResponse.json({ success: false, error: 'שגיאה בהצטרפות לחדר' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      playerId: result.playerId,
      session: {
        id: result.session.id,
        status: result.session.status
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
