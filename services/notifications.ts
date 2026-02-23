// services/notifications.ts
// Gerencia push notifications: registro de token, permissões e listeners
// NOTA: Todas as funções têm guard para web (onde expo-notifications não funciona)

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Imports condicionais — só carrega em mobile
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
let Constants: typeof import('expo-constants')['default'] | null = null;

if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Constants = require('expo-constants').default;

  // Configurar como as notificações aparecem em foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Registra o dispositivo para push notifications.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications || !Device || !Constants) {
    console.log('⚠️ Push notifications não disponíveis nesta plataforma');
    return null;
  }

  if (!Device.isDevice) {
    console.log('⚠️ Push notifications requerem dispositivo físico');
    return null;
  }

  try {
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

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error('❌ EAS projectId não configurado em app.json');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('📱 Push token:', token);

    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('❌ Erro ao salvar push_token:', error);
    } else {
      console.log('✅ Push token salvo');
    }

    // Canais Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WordFlow',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B5CD7',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('pratica', {
        name: 'Lembretes de Prática',
        description: 'Lembretes para praticar inglês',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B5CD7',
        sound: 'default',
      });

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

export type NotificationResponseCallback = (action: string, data: Record<string, any>) => void;

/**
 * Configura listeners de notificação.
 */
export function setupNotificationListeners(
  onTapNotification: NotificationResponseCallback
): () => void {
  if (Platform.OS === 'web' || !Notifications) {
    return () => {}; // noop cleanup
  }

  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notificação recebida (foreground):', notification.request.content.title);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const action = (data.action as string) || 'open_app';
    console.log('👆 Notificação tocada, action:', action);
    onTapNotification(action, data);
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

/**
 * Verifica se o app foi aberto por uma notificação (cold start)
 */
export async function getInitialNotification(): Promise<{ action: string; data: Record<string, any> } | null> {
  if (Platform.OS === 'web' || !Notifications) {
    return null;
  }

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;

    const data = response.notification.request.content.data || {};
    return {
      action: (data.action as string) || 'open_app',
      data,
    };
  } catch {
    return null;
  }
}

/**
 * Limpa o badge do ícone do app
 */
export async function clearBadge(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // ignore
  }
}