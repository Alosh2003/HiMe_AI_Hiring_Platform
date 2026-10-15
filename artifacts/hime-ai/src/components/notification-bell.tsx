import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import * as demoApi from '@/services/api/demo-api';
import { cn } from '@/lib/utils';

/**
 * The header bell, wired to real notifications instead of a permanently
 * lit dot. Unread count comes from the API; clicking an item marks it read.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<demoApi.AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const data = await demoApi.notifications();
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      // The bell must never break the page it sits on; it just stays quiet.
    }
  };

  useEffect(() => {
    void load();
    // Refresh when the tab regains focus — a decision made while the user
    // was elsewhere should be waiting for them.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const markRead = async (id: string) => {
    try {
      await demoApi.markNotificationRead(id);
      await load();
    } catch { /* keep the panel usable */ }
  };

  const markAll = async () => {
    try {
      await demoApi.markAllNotificationsRead();
      await load();
    } catch { /* keep the panel usable */ }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
        aria-label="الإشعارات"
        aria-expanded={open}
        onClick={toggle}
        data-testid="button-role-notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute end-1 top-1 h-2 w-2 rounded-full bg-accent"
            data-testid="badge-notifications-unread"
            aria-label={`${unread} غير مقروء`}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 top-12 z-50 w-80 rounded-xl border border-border bg-card p-2 shadow-xl"
          data-testid="panel-notifications"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-bold">الإشعارات</p>
            <button
              type="button"
              onClick={markAll}
              className="text-[11px] font-semibold text-primary"
              data-testid="button-notifications-read-all"
            >
              تحديد الكل كمقروء
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground" data-testid="text-notifications-empty">
              لا توجد إشعارات بعد
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'w-full rounded-lg px-2 py-2.5 text-start hover:bg-muted',
                      !n.read && 'bg-accent/5',
                    )}
                    data-testid={`item-notification-${n.id}`}
                  >
                    <p className={cn('text-xs', n.read ? 'text-muted-foreground' : 'font-bold')}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{n.body}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
