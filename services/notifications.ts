// services/notifications.ts
// Push notifications - registro, permissões e listeners
// Guard para web (expo-notifications não funciona)

import { Platform } from 'react-native';
import { supabase } from './supabase';

// ProjectId hardcoded como fallback (EAS builds podem não ter Constants.expoConfig)
const EAS_PROJECT_ID = 'd2208f21-c6c6-4855-8032-88359cbba8f6';

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
let Constants: typeof import('expo-constants')['default'] | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    Constants = require('expo-constants').default;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.error('❌ Erro ao carregar módulos de notificação:', e);
  }
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  console.log('🔔 registerForPushNotifications chamado para userId:', userId);

  if (Platform.OS === 'web' || !Notifications || !Device) {
    console.log('⚠️ Push não disponível: web ou módulos ausentes');
    return null;
  }

  if (!Device.isDevice) {
    console.log('⚠️ Push requer dispositivo físico (não emulador)');
    return null;
  }

  try {
    // 1. Verificar/solicitar permissão
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📋 Status permissão atual:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('📋 Status após solicitar:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permissão de notificação NEGADA');
      return null;
    }

    // 2. Obter projectId (tentar Constants, fallback para hardcoded)
    let projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    console.log('🔑 projectId de Constants:', projectId);

    if (!projectId) {
      projectId = EAS_PROJECT_ID;
      console.log('🔑 Usando projectId hardcoded:', projectId);
    }

    // 3. Obter push token
    console.log('📡 Solicitando push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('📱 Push token obtido:', token);

    // 4. Salvar no banco
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('❌ Erro ao salvar push_token no Supabase:', error.message);
    } else {
      console.log('✅ Push token salvo no Supabase com sucesso');
    }

    // 5. Canais Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WordFlow',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B5CD7',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('wordflow-frases', {
        name: 'Frases do Dia',
        description: 'Frases para praticar ao longo do dia',
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

      console.log('📢 Canais Android configurados');
    }

    return token;
  } catch (error: any) {
    console.error('❌ Erro ao registrar push:', error?.message || error);
    return null;
  }
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase.from('users').update({ push_token: null }).eq('id', userId);
    console.log('✅ Push token removido');
  } catch (error) {
    console.error('❌ Erro ao remover push_token:', error);
  }
}

export type NotificationResponseCallback = (action: string, data: Record<string, any>) => void;

export function setupNotificationListeners(
  onTapNotification: NotificationResponseCallback
): () => void {
  if (Platform.OS === 'web' || !Notifications) {
    return () => {};
  }

  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Push recebido (foreground):', notification.request.content.title);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const action = (data.action as string) || 'open_app';
    console.log('👆 Push tocado, action:', action);
    onTapNotification(action, data);
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

export async function getInitialNotification(): Promise<{ action: string; data: Record<string, any> } | null> {
  if (Platform.OS === 'web' || !Notifications) return null;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    const data = response.notification.request.content.data || {};
    return { action: (data.action as string) || 'open_app', data };
  } catch {
    return null;
  }
}

export async function clearBadge(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}