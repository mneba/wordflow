// hooks/useNotifications.ts
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  getInitialNotification,
  clearBadge,
} from '@/services/notifications';

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.id || initialized.current) return;
    initialized.current = true;

    registerForPushNotifications(user.id);
    clearBadge();

    getInitialNotification().then((notification) => {
      if (notification) {
        handleNotificationAction(notification.action, notification.data);
      }
    });

    const cleanup = setupNotificationListeners((action, data) => {
      handleNotificationAction(action, data);
    });

    return cleanup;
  }, [user?.id]);

  function handleNotificationAction(action: string, data: Record<string, any>) {
    console.log('🔔 Notification action:', action, data);

    switch (action) {
      case 'open_phrase':
        router.push({
          pathname: '/(tabs)/praticar',
          params: {
            sessao_id: data.sessao_id || '',
            frase_id: data.frase_id || '',
            from_push: 'true',
          },
        });
        break;

      case 'open_practice':
      case 'start_session':
        router.push('/(tabs)/praticar');
        break;

      case 'open_progress':
        router.push('/(tabs)/progress');
        break;

      case 'open_app':
      default:
        break;
    }

    clearBadge();
  }
}