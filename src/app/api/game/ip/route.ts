import { NextResponse } from 'next/server';
import os from 'os';

export async function GET(request: Request) {
  try {
    const hostHeader = request.headers.get('host') || 'localhost:3000';
    
    // Find the computer's local network IPv4 address
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      for (const config of iface) {
        // Look for non-internal IPv4 address
        if (config.family === 'IPv4' && !config.internal) {
          localIp = config.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }
    
    // If the site is accessed via localhost, rewrite it to use the local network IP
    let externalHost = hostHeader;
    if (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1')) {
      const port = hostHeader.split(':')[1] || '3000';
      externalHost = `${localIp}:${port}`;
    }
    
    return NextResponse.json({ success: true, ip: localIp, host: externalHost });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
