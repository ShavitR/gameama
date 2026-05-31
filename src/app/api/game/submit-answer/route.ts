import { NextResponse } from 'next/server';
import { submitAnswer } from '@/lib/gameState';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, playerId, answer } = body;

    if (!roomId || !playerId || answer === undefined) {
      return NextResponse.json({ success: false, error: 'נתונים חסרים' }, { status: 400 });
    }

    const success = await submitAnswer(roomId, playerId, answer);
    if (!success) {
      return NextResponse.json({ 
        success: false, 
        error: 'לא ניתן לשמור תשובה. ודא שהחדר פעיל ושהשאלה פתוחה למענה.' 
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
