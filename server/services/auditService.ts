import { run } from '../db/database.ts';

export function logAudit(
  userId: number | null,
  userName: string | null,
  action: string,
  entity: string,
  entityId: string | number,
  details: string
): void {
  try {
    const now = new Date().toISOString();
    run(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName || 'System', action, entity, String(entityId), details, now]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export function notifyUser(
  userId: number | null,
  title: string,
  message: string,
  type: string,
  link?: string
): void {
  try {
    const now = new Date().toISOString();
    run(
      `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [userId, title, message, type, link || null, now]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}
