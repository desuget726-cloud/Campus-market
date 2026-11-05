import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const ANNOUNCEMENT_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const ANNOUNCEMENT_SNOOZE_MS = 3 * 60 * 60 * 1000;
const ANNOUNCEMENT_SNOOZE_PREFIX = 'announcement_snooze_';
const SESSION_DISMISSAL_PREFIX = 'announcement_session_dismissed_';

const readStoredTimestamp = (storage, key) => {
  try {
    const timestamp = Number(storage.getItem(key));
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  } catch (error) {
    console.warn('Failed to read announcement dismissal:', error);
    return 0;
  }
};

const clearAnnouncementDismissal = (id) => {
  try {
    window.localStorage.removeItem(`${ANNOUNCEMENT_SNOOZE_PREFIX}${id}`);
  } catch (error) {
    console.warn('Failed to clear announcement snooze:', error);
  }
  try {
    window.sessionStorage.removeItem(`${SESSION_DISMISSAL_PREFIX}${id}`);
  } catch (error) {
    console.warn('Failed to clear session announcement dismissal:', error);
  }
};

const isAnnouncementFresh = (item, now) => {
  const rawTimestamp = item.created_at || item.sent_at || '';
  const timestamp = typeof rawTimestamp === 'string'
    && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawTimestamp)
    ? `${rawTimestamp.replace(' ', 'T')}Z`
    : rawTimestamp;
  const createdAt = new Date(timestamp).getTime();
  const age = now - createdAt;
  return Number.isFinite(createdAt) && age >= 0 && age < ANNOUNCEMENT_MAX_AGE_MS;
};

const isUrgentAnnouncement = (item) => item.urgent_banner === true || item.banner_pinned === true;

const isAnnouncementSnoozed = (id, now) => {
  const localTimestamp = readStoredTimestamp(window.localStorage, `${ANNOUNCEMENT_SNOOZE_PREFIX}${id}`);
  const sessionTimestamp = readStoredTimestamp(window.sessionStorage, `${SESSION_DISMISSAL_PREFIX}${id}`);
  const dismissedAt = Math.max(localTimestamp, sessionTimestamp);
  if (!dismissedAt) return false;

  const snoozeAge = now - dismissedAt;
  if (snoozeAge < 0 || snoozeAge >= ANNOUNCEMENT_SNOOZE_MS) {
    clearAnnouncementDismissal(id);
    return false;
  }
  return true;
};

function CampusAnnouncementBanner({ studentId, accessToken }) {
  const [announcement, setAnnouncement] = useState(null);
  const [modalAnnouncementId, setModalAnnouncementId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let requestInFlight = false;
    const loadAnnouncement = async () => {
      if (requestInFlight || controller.signal.aborted) return;
      requestInFlight = true;
      const announcements = [];

      try {
        const response = await fetch(`${API_BASE_URL}/api/announcements/active`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Unable to load campus announcements (HTTP ${response.status}).`);
        }
        const data = await response.json();
        announcements.push(...(Array.isArray(data) ? data : data?.announcements || []));
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load public campus announcements:', error);
        }
      }

      if (studentId && accessToken && !controller.signal.aborted) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/student/announcements/urgent?student_id=${encodeURIComponent(studentId)}`,
            {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: controller.signal,
            },
          );
          if (!response.ok) {
            throw new Error(`Unable to load targeted campus announcement (HTTP ${response.status}).`);
          }
          const data = await response.json();
          if (data) announcements.push(data);
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Failed to load targeted campus announcement:', error);
          }
        }
      }

      if (!controller.signal.aborted) {
        const now = Date.now();
        const uniqueAnnouncements = [...new Map(
          announcements
            .filter((item) => item?.id != null)
            .map((item) => [String(item.id), item]),
        ).values()];
        uniqueAnnouncements.sort((left, right) => (
          new Date(right.created_at || right.sent_at || 0).getTime()
          - new Date(left.created_at || left.sent_at || 0).getTime()
          || Number(right.id) - Number(left.id)
        ));
        setAnnouncement(uniqueAnnouncements.find((item) => (
          isUrgentAnnouncement(item)
          && isAnnouncementFresh(item, now)
          && !isAnnouncementSnoozed(item.id, now)
        )) || null);
      }

      requestInFlight = false;
    };

    void loadAnnouncement();
    const refreshVisibleTab = () => {
      if (document.visibilityState === 'visible') void loadAnnouncement();
    };
    const pollId = window.setInterval(loadAnnouncement, 30_000);
    window.addEventListener('focus', refreshVisibleTab);
    document.addEventListener('visibilitychange', refreshVisibleTab);
    return () => {
      controller.abort();
      window.clearInterval(pollId);
      window.removeEventListener('focus', refreshVisibleTab);
      document.removeEventListener('visibilitychange', refreshVisibleTab);
    };
  }, [accessToken, studentId]);

  useEffect(() => {
    if (modalAnnouncementId == null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setModalAnnouncementId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalAnnouncementId]);

  const dismissAnnouncement = () => {
    if (!announcement) return;
    const dismissedAt = Date.now();
    try {
      window.localStorage.setItem(`${ANNOUNCEMENT_SNOOZE_PREFIX}${announcement.id}`, dismissedAt);
    } catch (error) {
      console.warn('Failed to save announcement snooze:', error);
    }
    try {
      window.sessionStorage.setItem(`${SESSION_DISMISSAL_PREFIX}${announcement.id}`, dismissedAt);
    } catch (error) {
      console.warn('Failed to save session announcement dismissal:', error);
    }
    setModalAnnouncementId(null);
    setAnnouncement(null);
  };

  if (!announcement) return null;

  return (
    <>
      <aside
        role="status"
        aria-live="polite"
        className="announcement-banner sticky top-0 z-30 flex w-full items-center overflow-hidden border-b border-emerald-900 bg-emerald-800 px-4 py-2 text-white shadow-md"
      >
        <span
          aria-hidden="true"
          className="relative z-10 flex h-full shrink-0 items-center bg-emerald-800 text-emerald-200"
        >
          <Megaphone className="mr-2 h-5 w-5 text-lg text-emerald-200" />
        </span>
        <button
          type="button"
          onClick={() => announcement.image_url && setModalAnnouncementId(announcement.id)}
          disabled={!announcement.image_url}
          aria-label={announcement.image_url ? `View announcement: ${announcement.title}` : undefined}
          className="announcement-marquee relative min-w-0 flex-1 overflow-hidden whitespace-nowrap border-0 bg-transparent p-0 text-left text-sm font-extrabold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] sm:text-base disabled:cursor-default"
        >
          <p className="announcement-marquee-track flex w-max">
            {[false, true].map((isDuplicate) => (
              <span
                key={String(isDuplicate)}
                aria-hidden={isDuplicate || undefined}
                className="flex shrink-0 items-center pr-12"
              >
                <span className="mr-3 inline-block rounded-full bg-white px-3 py-0.5 text-xs font-black text-emerald-900 shadow-xs sm:text-sm">
                  {announcement.title}
                </span>
                <span aria-hidden="true" className="px-2">—</span>
                <span>{announcement.message}</span>
              </span>
            ))}
          </p>
        </button>
        <button
          type="button"
          onClick={dismissAnnouncement}
          aria-label="Dismiss campus announcement"
          className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-1.5 text-base font-bold text-white transition hover:bg-emerald-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ✕
        </button>
      </aside>
      {modalAnnouncementId === announcement.id && announcement.image_url && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalAnnouncementId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="campus-announcement-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-end p-3">
              <button
                type="button"
                onClick={() => setModalAnnouncementId(null)}
                aria-label="Close announcement"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <img
              src={announcement.image_url}
              alt={announcement.title}
              className="max-h-[60vh] w-full object-contain"
            />
            <div className="px-6 pb-6 pt-5">
              <h2 id="campus-announcement-title" className="text-xl font-black text-slate-950">
                {announcement.title}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {announcement.message}
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default CampusAnnouncementBanner;
