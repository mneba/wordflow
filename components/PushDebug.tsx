// components/PushDebug.tsx
// TEMPORÁRIO - botão de debug para diagnosticar push token
// Remover depois de resolver

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

export default function PushDebug() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addLog = (msg: string) => {
    console.log('🔧 PUSH DEBUG:', msg);
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  const testPush = async () => {
    setLog([]);
    setTesting(true);

    try {
      // 1. Check básico
      addLog(`Platform: ${Platform.OS}`);
      addLog(`user.id: ${user?.id || 'NULL'}`);
      addLog(`session.user.id: ${session?.user?.id || 'NULL'}`);

      if (Platform.OS === 'web') {
        addLog('❌ Web não suporta push');
        setTesting(false);
        return;
      }

      // 2. Importar módulos
      addLog('Importando módulos...');
      let Notifications: any;
      let Device: any;
      let Constants: any;

      try {
        Notifications = require('expo-notifications');
        addLog('✅ expo-notifications carregado');
      } catch (e: any) {
        addLog(`❌ expo-notifications FALHOU: ${e.message}`);
        setTesting(false);
        return;
      }

      try {
        Device = require('expo-device');
        addLog(`✅ expo-device carregado, isDevice: ${Device.isDevice}`);
      } catch (e: any) {
        addLog(`❌ expo-device FALHOU: ${e.message}`);
        setTesting(false);
        return;
      }

      try {
        Constants = require('expo-constants').default;
        addLog(`✅ expo-constants carregado`);
        addLog(`   expoConfig: ${Constants.expoConfig ? 'EXISTS' : 'NULL'}`);
        addLog(`   projectId: ${Constants.expoConfig?.extra?.eas?.projectId || 'NULL'}`);
      } catch (e: any) {
        addLog(`❌ expo-constants FALHOU: ${e.message}`);
      }

      if (!Device.isDevice) {
        addLog('❌ Não é dispositivo físico');
        setTesting(false);
        return;
      }

      // 3. Permissão
      addLog('Verificando permissão...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      addLog(`Permissão atual: ${existingStatus}`);

      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        addLog('Solicitando permissão...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        addLog(`Permissão após solicitar: ${finalStatus}`);
      }

      if (finalStatus !== 'granted') {
        addLog('❌ PERMISSÃO NEGADA');
        setTesting(false);
        return;
      }
      addLog('✅ Permissão OK');

      // 4. Obter token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || 'd2208f21-c6c6-4855-8032-88359cbba8f6';
      addLog(`Usando projectId: ${projectId}`);
      addLog('Solicitando token...');

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        addLog(`✅ TOKEN OBTIDO: ${token}`);

        // 5. Salvar no banco
        addLog(`Salvando para user_id: ${user?.id}`);
        const { error } = await supabase
          .from('users')
          .update({ push_token: token })
          .eq('id', user?.id);

        if (error) {
          addLog(`❌ ERRO ao salvar: ${error.message}`);
        } else {
          addLog('✅ TOKEN SALVO NO BANCO!');
        }

        // 6. Verificar
        const { data: check } = await supabase
          .from('users')
          .select('push_token')
          .eq('id', user?.id)
          .single();

        addLog(`Verificação: push_token = ${check?.push_token || 'NULL'}`);

      } catch (tokenErr: any) {
        addLog(`❌ ERRO ao obter token: ${tokenErr.message}`);
        addLog(`   Stack: ${tokenErr.stack?.substring(0, 200)}`);
      }

    } catch (err: any) {
      addLog(`❌ ERRO GERAL: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.rose }]}>🔧 Push Debug (temporário)</Text>

      <TouchableOpacity
        onPress={testPush}
        disabled={testing}
        style={[styles.btn, { backgroundColor: colors.accent }]}
      >
        <Text style={styles.btnText}>
          {testing ? 'Testando...' : 'Testar Push Token'}
        </Text>
      </TouchableOpacity>

      {log.length > 0 && (
        <View style={[styles.logBox, { backgroundColor: colors.bg }]}>
          {log.map((l, i) => (
            <Text key={i} style={[styles.logLine, {
              color: l.includes('❌') ? colors.rose : l.includes('✅') ? colors.green : colors.text2
            }]}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { margin: 20, padding: 16, borderRadius: 14, borderWidth: 1 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logBox: { marginTop: 12, padding: 12, borderRadius: 8 },
  logLine: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18 },
});