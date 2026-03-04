// hooks/useNotifications.ts
// Registra push, ouve notificações, direciona para tela correta

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

    // Verificar se app foi aberto por push
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
        // Push de frase → tela dedicada
        router.push({
          pathname: '/push-phrase',
          params: {
            sessao_id: data.sessao_id || '',
            frase_id: data.frase_id || '',
            controle_envio_id: data.controle_envio_id || '',
            ordem: data.ordem?.toString() || '1',
            total: data.total?.toString() || '5',
          },
        });
        break;

      case 'open_practice':
      case 'start_session':
        router.push('/(tabs)/praticar');
        break;

      case 'open_progress':
        router.push('/(tabs)/phrases');
        break;

      case 'open_app':
      default:
        break;
    }

    clearBadge();
  }
}
