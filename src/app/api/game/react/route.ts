import { NextResponse } from 'next/server';
import { addReaction, getSession } from '@/lib/gameState';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, playerId, emoji } = body;

    if (!roomId || !playerId || !emoji) {
      return NextResponse.json({ success: false, error: 'נתונים חסרים' }, { status: 400 });
    }

    const session = await getSession(roomId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'החדר לא נמצא' }, { status: 404 });
    }

    const player = session.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: 'שחקן לא קיים בחדר' }, { status: 404 });
    }

    const success = await addReaction(roomId, emoji, player.nickname);
    if (!success) {
      return NextResponse.json({ success: false, error: 'שגיאה בשמירת התגובה' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
