import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Pulls recent lifelogs directly from the Limitless API and upserts them
// into the Lifelog table. Raw import only — no summarization/categorization
// here (that mirrors what the separate Google Sheet/Apps Script pipeline
// already does; this is a different, additive data source).

type LimitlessLifelog = {
  id: string;
  title: string;
  text: string;
  metadata: {
    startTime: string;
    endTime?: string;
    isStarred?: boolean;
  };
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.LIMITLESS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "LIMITLESS_API_KEY is not set on this deployment" },
      { status: 500 }
    );
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : 7;
  const start = new Date();
  start.setDate(start.getDate() - days);

  let imported = 0;
  let cursor: string | undefined;
  const results: LimitlessLifelog[] = [];

  try {
    do {
      const url = new URL("https://api.limitless.ai/v1/lifelogs");
      url.searchParams.set("start", start.toISOString());
      url.searchParams.set("limit", "10");
      url.searchParams.set("includeMarkdown", "true");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: { "X-API-Key": apiKey },
      });

      if (!res.ok) {
        const body = await res.text();
        return NextResponse.json(
          { error: `Limitless API error ${res.status}`, body },
          { status: 502 }
        );
      }

      const data = await res.json();
      const lifelogs: LimitlessLifelog[] = data?.data?.lifelogs ?? [];
      results.push(...lifelogs);
      cursor = data?.meta?.lifelogs?.nextCursor ?? undefined;
    } while (cursor && results.length < 200);

    for (const log of results) {
      await prisma.lifelog.upsert({
        where: { id: log.id },
        create: {
          id: log.id,
          title: log.title ?? "",
          text: log.text ?? "",
          startTime: new Date(log.metadata.startTime),
          endTime: log.metadata.endTime ? new Date(log.metadata.endTime) : null,
          isStarred: log.metadata.isStarred ?? false,
        },
        update: {
          title: log.title ?? "",
          text: log.text ?? "",
          endTime: log.metadata.endTime ? new Date(log.metadata.endTime) : null,
          isStarred: log.metadata.isStarred ?? false,
        },
      });
      imported++;
    }

    return NextResponse.json({ status: "success", imported, fetched: results.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Sync failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
