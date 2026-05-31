import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Extract project ref from the Supabase URL
  // We just need to check if ANY supabase auth cookie exists
  // The cookies usually look like sb-[project-ref]-auth-token
  
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

  // Protected routes logic
  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/inventory') ||
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/purchases') ||
    request.nextUrl.pathname.startsWith('/invoice') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/staff');

  if (isProtectedRoute && !hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === '/login' && hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/inventory/:path*',
    '/pos/:path*',
    '/purchases/:path*',
    '/invoice/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/staff/:path*',
    '/login'
  ],
};
