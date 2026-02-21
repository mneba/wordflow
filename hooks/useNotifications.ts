// hooks/useNotifications.ts
// Hook que integra push notifications com o app
// - Registra token automaticamente ao montar
// - Configura listener para tocar na notificação → navegar
// - Trata cold start (app aberto pela notificação)

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  getInitialNotification,
  clearBadge,
} from '../services/notifications';

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.id || initialized.current) return;
    initialized.current = true;

    // 1. Registrar push token
    registerForPushNotifications(user.id);

    // 2. Limpar badge ao abrir o app
    clearBadge();

    // 3. Verificar se o app foi aberto por uma notificação (cold start)
    getInitialNotification().then((notification) => {
      if (notification) {
        handleNotificationAction(notification.action, notification.data);
      }
    });

    // 4. Configurar listener para toques em notificações (warm start)
    const cleanup = setupNotificationListeners((action, data) => {
      handleNotificationAction(action, data);
    });

    return cleanup;
  }, [user?.id]);

  /**
   * Decide o que fazer quando o usuário toca na notificação
   */
  function handleNotificationAction(action: string, data: Record<string, any>) {
    console.log('🔔 Handling notification action:', action);

    switch (action) {
      case 'open_practice':
      case 'start_session':
        // Navegar para a tela de prática
        router.push('/(tabs)/praticar');
        break;

      case 'open_progress':
        // Navegar para progresso
        router.push('/(tabs)/progress');
        break;

      case 'open_app':
      default:
        // Apenas abre o app na Home (comportamento padrão)
        break;
    }

    // Limpar badge após interação
    clearBadge();
  }
}
