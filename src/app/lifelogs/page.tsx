import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LifelogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/signin");
  }

  const logs = await prisma.lifelog.findMany({
    orderBy: { startTime: "desc" },
    take: 100,
  });

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Lifelogs</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Raw entries pulled from Limitless. {logs.length} shown.
      </p>

      {session.user.role === "admin" && (
        <form action="/api/sync/limitless" method="POST" style={{ marginBottom: "2rem" }}>
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Sync now
          </button>
        </form>
      )}

      {logs.length === 0 && (
        <p style={{ color: "#999" }}>
          No lifelogs yet. Click &quot;Sync now&quot; above to pull recent entries.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {logs.map((log) => (
          <li
            key={log.id}
            style={{
              borderBottom: "1px solid #eee",
              padding: "1rem 0",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#999" }}>
              {log.startTime.toLocaleString()}
              {log.isStarred ? " ★" : ""}
            </div>
            <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>{log.title}</div>
            <div style={{ color: "#444", marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>
              {log.text.length > 300 ? log.text.slice(0, 300) + "…" : log.text}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
