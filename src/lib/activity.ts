import { prisma } from "@/lib/prisma";
import { activity_type, Prisma } from "@/generated/prisma";

interface ActivityData {
  actorId: string;
  type: activity_type;
  placeId?: string;
  listId?: string;
  metadata?: Prisma.InputJsonValue;
}

function generateDedupeKey(data: ActivityData): string {
  const date = new Date().toISOString().split("T")[0];
  const targetId = data.placeId || data.listId || "none";
  return `${data.actorId}:${data.type}:${targetId}:${date}`;
}

export async function createActivity(data: ActivityData): Promise<void> {
  const dedupeKey = generateDedupeKey(data);
  
  try {
    await prisma.activity.create({
      data: {
        actorId: data.actorId,
        type: data.type,
        placeId: data.placeId || null,
        listId: data.listId || null,
        metadata: data.metadata,
        dedupeKey,
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return;
    }
    throw error;
  }
}
