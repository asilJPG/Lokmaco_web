import { cleanupOldInvoicePhotos } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.headers.get("x-user-id");
    const [baseRole] = (request.headers.get("x-user-role") || "").split(":");
    const authHeader = String(request.headers.get("authorization") || "").trim();
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    const querySecret = String(searchParams.get("secret") || "").trim();

    const isCron = Boolean(cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret));
    const isAdmin = Boolean(userId && baseRole === "admin");

    if (!isAdmin && !isCron) {
      return Response.json({ error: "Доступ только для администратора" }, { status: 403 });
    }

    const days = Math.max(7, parseInt(searchParams.get("days") || "30", 10) || 30);
    const result = await cleanupOldInvoicePhotos(days);

    return Response.json(result);
  } catch (e) {
    console.error("[cleanup-photos]", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
