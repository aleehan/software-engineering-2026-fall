import { and, asc, eq, lte } from 'drizzle-orm'
import type { Db } from './database'
import {
  pendingChanges,
  type PendingChange,
  type PendingChangeKind,
  type PendingChangeStatus
} from './schema'

export interface RequestChangeInput {
  kind: PendingChangeKind
  value?: number | null
  textValue?: string | null
  requestedAt: Date
  delayMs: number
}

export function requestChange(db: Db, input: RequestChangeInput): PendingChange {
  return db
    .insert(pendingChanges)
    .values({
      kind: input.kind,
      value: input.value ?? null,
      textValue: input.textValue ?? null,
      requestedAt: input.requestedAt,
      // Date хранит время в миллисекундах; getTime() + задержка = момент применения.
      applyAfter: new Date(input.requestedAt.getTime() + input.delayMs)
    })
    .returning()
    .get()
}

/** Все ожидающие изменения (для отображения в UI). */
export function listPendingChanges(db: Db): PendingChange[] {
  return db
    .select()
    .from(pendingChanges)
    .where(eq(pendingChanges.status, 'pending'))
    .orderBy(asc(pendingChanges.applyAfter))
    .all()
}

/** Ожидающие изменения, у которых задержка уже истекла к моменту `now`. */
export function listDueChanges(db: Db, now: Date): PendingChange[] {
  return db
    .select()
    .from(pendingChanges)
    .where(and(eq(pendingChanges.status, 'pending'), lte(pendingChanges.applyAfter, now)))
    .orderBy(asc(pendingChanges.applyAfter))
    .all()
}

/** Отменяет все ожидающие изменения данного вида. Возвращает число отменённых. */
export function cancelPendingOfKind(db: Db, kind: PendingChangeKind): number {
  return db
    .update(pendingChanges)
    .set({ status: 'cancelled' })
    .where(and(eq(pendingChanges.status, 'pending'), eq(pendingChanges.kind, kind)))
    .run().changes
}

export function setChangeStatus(db: Db, id: number, status: PendingChangeStatus): void {
  db.update(pendingChanges).set({ status }).where(eq(pendingChanges.id, id)).run()
}
