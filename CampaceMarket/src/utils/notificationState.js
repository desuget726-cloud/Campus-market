export const shouldReduceUnreadNotificationCount = (notification) => Boolean(notification && !notification.read);
