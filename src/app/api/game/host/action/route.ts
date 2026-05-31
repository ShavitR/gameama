import { NextResponse } from 'next/server';
import { handleHostAction } from '@/lib/gameState';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, action, payload } = body;

    if (!roomId || !action) {
      return NextResponse.json({ success: false, error: 'נתונים חסרים' }, { status: 400 });
    }

    const updatedSession = await handleHostAction(roomId, action, payload);
    if (!updatedSession) {
      return NextResponse.json({ success: false, error: 'לא ניתן לבצע את הפעולה המבוקשת' }, { status: 400 });
    }

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
