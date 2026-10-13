import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const publicRoutes = createRouteMatcher([
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/track-order(.*)",
    "/api/track-order(.*)",
    "/api/webhook/gmail(.*)",
    "/api/root(.*)"
]);

// These handlers authenticate either ADMIN_SECRET or a workspace administrator.
// Do not require a browser session before the handler can verify service access.
const serviceRoutes = createRouteMatcher([
    "/api/admin/backfill",
    "/api/admin/outbox/process",
    "/api/admin/schemes/expire",
    "/api/admin/schemes/issue",
    "/api/admin/signals/rebuild",
]);

export default clerkMiddleware(async (auth, req) => {
    if (serviceRoutes(req)) return;
    // APIs return 401 JSON for unauthenticated callers (never a redirect).
    if (req.nextUrl.pathname.startsWith('/api/') && !publicRoutes(req)) {
        const a = await auth();
        if (!a.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        return;
    }
    if (!publicRoutes(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
};
