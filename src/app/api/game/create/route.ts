import { NextResponse } from 'next/server';
import { createSession } from '@/lib/gameState';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const questionCount = body.questionCount || 5;
    const customQuestions = body.customQuestions || undefined;
    const session = await createSession(questionCount, customQuestions);
    
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
