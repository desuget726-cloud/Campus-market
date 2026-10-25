const CHANGE_EVENT = 'campace:admin-seen-changed';
const STORAGE_KEY = 'campaceAdminSeenChangedAt';
const CHANNEL_NAME = 'campace-admin-item-seen';

let channel;

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    channel ||= new BroadcastChannel(CHANNEL_NAME);
    return channel;
  } catch (error) {
    console.warn('Unable to open the admin seen-state broadcast channel.', error);
    return null;
  }
}

export function notifyAdminSeenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGE_EVENT));

  const broadcastChannel = getChannel();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ changedAt: Date.now() });
      return;
    } catch (error) {
      console.warn('Unable to broadcast an admin seen-state change.', error);
    }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch (error) {
    console.warn('Unable to persist an admin seen-state change for other tabs.', error);
  }
}

export function subscribeToAdminSeenChanges(onChange) {
  if (typeof window === 'undefined') return () => {};

  const broadcastChannel = getChannel();
  const handleLocalChange = () => onChange();
  const handleStorageChange = (event) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  const handleBroadcast = () => onChange();

  window.addEventListener(CHANGE_EVENT, handleLocalChange);
  window.addEventListener('storage', handleStorageChange);
  broadcastChannel?.addEventListener('message', handleBroadcast);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleLocalChange);
    window.removeEventListener('storage', handleStorageChange);
    broadcastChannel?.removeEventListener('message', handleBroadcast);
  };
}
