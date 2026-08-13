import { db, schema } from '@/db/client';

/**
 * Запись документа в историю сайта.
 *
 * Зовётся уже ПОСЛЕ того, как документ принят iiko, поэтому падать здесь
 * нельзя: 500 после успешной отправки заставит пользователя нажать «создать»
 * ещё раз, и в iiko уедет дубль. Ошибку пишем в лог и возвращаем null —
 * расходится только история сайта, а её можно восстановить из iiko.
 *
 * Возвращает id записи: по нему приход находит себя, когда сразу после
 * проведения отправляет фотоотчёт и помечает его отправленным.
 */
export async function logAction(input: {
  filialId: number;
  tgId: number | null;
  userName: string;
  actionType: string;
  documentNumber?: string | null;
  details: Record<string, unknown>;
}): Promise<number | null> {
  try {
    const [row] = await db.insert(schema.botActions).values({
      filialId: input.filialId,
      tgId: input.tgId,
      userName: input.userName,
      actionType: input.actionType,
      documentNumber: input.documentNumber ?? null,
      details: input.details,
    }).returning({ id: schema.botActions.id });
    return row?.id ?? null;
  } catch (e) {
    console.error('[logAction] документ в iiko создан, но в историю не записан', input.actionType, input.documentNumber, e);
    return null;
  }
}
