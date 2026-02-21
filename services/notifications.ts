// services/notifications.ts
// Gerencia push notifications: registro de token, permissões e listeners
// Usa Expo Push Notifications (https://docs.expo.dev/push-notifications/overview/)

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configurar como as notificações aparecem quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registra o dispositivo para push notifications.
 * 1. Verifica se é dispositivo físico
 * 2. Pede permissão
 * 3. Obtém token Expo Push
 * 4. Salva em users.push_token
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Push não funciona em emulador/web
  if (!Device.isDevice) {
    console.log('⚠️ Push notifications requerem dispositivo físico');
    return null;
  }

  // Não funciona na web
  if (Platform.OS === 'web') {
    console.log('⚠️ Push notifications não disponíveis na web');
    return null;
  }

  try {
    // 1. Verificar/pedir permissão
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('⚠️ Permissão de notificação negada');
      return null;
    }

    // 2. Obter Project ID do Expo
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('❌ EAS projectId não configurado em app.json');
      return null;
    }

    // 3. Obter token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData.data;
    console.log('📱 Push token:', token);

    // 4. Salvar no Supabase
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('❌ Erro ao salvar push_token:', error);
    } else {
      console.log('✅ Push token salvo');
    }

    // 5. Configurar canal Android (necessário para Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WordFlow',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B5CD7',
        sound: 'default',
      });

      // Canal específico para lembretes de prática
      await Notifications.setNotificationChannelAsync('pratica', {
        name: 'Lembretes de Prática',
        description: 'Lembretes para praticar inglês',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B5CD7',
        sound: 'default',
      });

      // Canal para streak em risco
      await Notifications.setNotificationChannelAsync('streak', {
        name: 'Alertas de Streak',
        description: 'Aviso quando seu streak está em risco',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#F59E0B',
        sound: 'default',
      });
    }

    return token;
  } catch (error) {
    console.error('❌ Erro ao registrar push:', error);
    return null;
  }
}

/**
 * Remove o push token do usuário (ex: ao fazer logout)
 */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ push_token: null })
      .eq('id', userId);
    console.log('✅ Push token removido');
  } catch (error) {
    console.error('❌ Erro ao remover push_token:', error);
  }
}

/**
 * Tipo para a callback de quando o usuário toca na notificação
 */
export type NotificationResponseCallback = (action: string, data: Record<string, any>) => void;

/**
 * Configura listeners de notificação.
 * Retorna função de cleanup para usar no useEffect.
 */
export function setupNotificationListeners(
  onTapNotification: NotificationResponseCallback
): () => void {
  // Listener: notificação recebida com app em foreground
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notificação recebida (foreground):', notification.request.content.title);
  });

  // Listener: usuário tocou na notificação
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const action = (data.action as string) || 'open_app';
    console.log('👆 Notificação tocada, action:', action, 'data:', data);
    onTapNotification(action, data);
  });

  // Cleanup
  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

/**
 * Verifica se a última notificação que abriu o app tem dados
 * (útil para cold start — app estava fechado)
 */
export async function getInitialNotification(): Promise<{ action: string; data: Record<string, any> } | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;

  const data = response.notification.request.content.data || {};
  return {
    action: (data.action as string) || 'open_app',
    data,
  };
}

/**
 * Limpa o badge do ícone do app
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
