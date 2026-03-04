// app/(tabs)/profile.tsx
// Perfil — dados do usuário + configurações + debug push

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ═══════════════════════════════════════
// PUSH DEBUG (temporário — remover depois)
// ═══════════════════════════════════════
function PushDebug({ userId, colors }: { userId: string | undefined; colors: any }) {
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
      addLog(`Platform: ${Platform.OS}`);
      addLog(`userId: ${userId || 'NULL'}`);

      if (Platform.OS === 'web') {
        addLog('❌ Web não suporta push');
        setTesting(false);
        return;
      }

      // Importar módulos
      let Notifications: any;
      let Device: any;
      let Constants: any;

      try {
        Notifications = require('expo-notifications');
        addLog('✅ expo-notifications OK');
      } catch (e: any) {
        addLog(`❌ expo-notifications: ${e.message}`);
        setTesting(false);
        return;
      }

      try {
        Device = require('expo-device');
        addLog(`✅ expo-device OK, isDevice: ${Device.isDevice}`);
      } catch (e: any) {
        addLog(`❌ expo-device: ${e.message}`);
        setTesting(false);
        return;
      }

      try {
        Constants = require('expo-constants').default;
        const pid = Constants.expoConfig?.extra?.eas?.projectId;
        addLog(`✅ Constants OK, projectId: ${pid || 'NULL'}`);
      } catch (e: any) {
        addLog(`⚠️ Constants falhou: ${e.message}`);
      }

      if (!Device.isDevice) {
        addLog('❌ Não é dispositivo físico');
        setTesting(false);
        return;
      }

      // Permissão
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      addLog(`Permissão atual: ${existingStatus}`);

      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        addLog(`Permissão solicitada: ${finalStatus}`);
      }

      if (finalStatus !== 'granted') {
        addLog('❌ PERMISSÃO NEGADA');
        setTesting(false);
        return;
      }
      addLog('✅ Permissão OK');

      // Token
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || 'd2208f21-c6c6-4855-8032-88359cbba8f6';
      addLog(`projectId: ${projectId}`);
      addLog('Solicitando token...');

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        addLog(`✅ TOKEN: ${token}`);

        // Salvar
        addLog(`Salvando para userId: ${userId}`);
        const { error } = await supabase
          .from('users')
          .update({ push_token: token })
          .eq('id', userId);

        if (error) {
          addLog(`❌ Erro ao salvar: ${error.message}`);
        } else {
          addLog('✅ SALVO NO BANCO!');
        }

        // Verificar
        const { data: check } = await supabase
          .from('users')
          .select('push_token')
          .eq('id', userId)
          .single();

        addLog(`Verificação: ${check?.push_token || 'NULL'}`);

      } catch (tokenErr: any) {
        addLog(`❌ Erro token: ${tokenErr.message}`);
        if (tokenErr.code) addLog(`   Code: ${tokenErr.code}`);
      }

    } catch (err: any) {
      addLog(`❌ ERRO GERAL: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={[debugStyles.container, { backgroundColor: colors.bgCard, borderColor: colors.rose }]}>
      <Text style={[debugStyles.title, { color: colors.rose }]}>🔧 Push Debug (temporário)</Text>

      <TouchableOpacity
        onPress={testPush}
        disabled={testing}
        style={[debugStyles.btn, { backgroundColor: colors.accent }]}
      >
        {testing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={debugStyles.btnText}>Testar Push Token</Text>
        }
      </TouchableOpacity>

      {log.length > 0 && (
        <View style={[debugStyles.logBox, { backgroundColor: colors.bg }]}>
          {log.map((l, i) => (
            <Text key={i} style={[debugStyles.logLine, {
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

const debugStyles = StyleSheet.create({
  container: { marginBottom: 20, padding: 16, borderRadius: 14, borderWidth: 2 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logBox: { marginTop: 12, padding: 12, borderRadius: 8 },
  logLine: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18 },
});

// ═══════════════════════════════════════
// PROFILE SCREEN
// ═══════════════════════════════════════
export default function ProfileScreen() {
  const { colors, toggleTheme, mode } = useTheme();
  const { user, signOut, refreshProfile } = useAuth();

  const [horaInicio, setHoraInicio] = useState('08');
  const [horaFim, setHoraFim] = useState('21');
  const [audioEnabled, setAudioEnabled] = useState(user?.audio_habilitado || false);
  const [saving, setSaving] = useState(false);

  const iniciais = (user?.nome || 'U')
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const nome = user?.nome || 'Estudante';
  const email = user?.email || '';
  const nivel = user?.nivel || 'basico';
  const status = user?.status || 'trial';
  const diasConsecutivos = user?.dias_consecutivos || 0;
  const totalFrases = user?.total_frases_vistas || 0;
  const totalCorretas = user?.total_frases_corretas || 0;
  const taxaAcerto = totalFrases > 0 ? Math.round((totalCorretas / totalFrases) * 100) : 0;

  const nivelLabel: Record<string, string> = {
    basico: 'Básico',
    intermediario: 'Intermediário',
    avancado: 'Avançado',
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    trial: { text: 'Período de teste', color: '#F59E0B' },
    ativo: { text: 'Assinante ativo', color: '#10B981' },
    inativo: { text: 'Inativo', color: '#EF4444' },
  };

  const handleSaveHorarios = useCallback(async () => {
    if (!user?.id) return;
    haptic();
    setSaving(true);
    try {
      const faixaProibida = `${horaFim}:00-${horaInicio}:00`;
      const { error } = await supabase
        .from('users')
        .update({ horarios_proibidos: [faixaProibida] })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      if (Platform.OS !== 'web') {
        Alert.alert('✅ Salvo', `Notificações entre ${horaInicio}:00 e ${horaFim}:00`);
      }
    } catch (err) {
      console.error('Erro ao salvar horários:', err);
    } finally {
      setSaving(false);
    }
  }, [horaInicio, horaFim, user?.id, refreshProfile]);

  const handleToggleAudio = useCallback(async (value: boolean) => {
    if (!user?.id) return;
    setAudioEnabled(value);
    try {
      await supabase.from('users').update({ audio_habilitado: value }).eq('id', user.id);
    } catch {
      setAudioEnabled(!value);
    }
  }, [user?.id]);

  const handleLogout = useCallback(() => {
    haptic();
    if (Platform.OS === 'web') { signOut(); return; }
    Alert.alert('Sair da conta', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  const stInfo = statusLabel[status] || statusLabel.trial;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ═══ PUSH DEBUG — REMOVER DEPOIS ═══ */}
        <PushDebug userId={user?.id} colors={colors} />

        {/* Avatar + Nome */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>{iniciais}</Text>
          </View>
          <Text style={[styles.nome, { color: colors.text1 }]}>{nome}</Text>
          <Text style={[styles.email, { color: colors.text3 }]}>{email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: stInfo.color + '20' }]}>
              <Text style={[styles.badgeText, { color: stInfo.color }]}>{stInfo.text}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.accent + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                {nivelLabel[nivel] || nivel}
              </Text>
            </View>
          </View>
        </View>

        {/* Resumo de atividade */}
        <View style={[styles.statsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.statsTitle, { color: colors.text1 }]}>Seu progresso</Text>

          <View style={styles.statRow}>
            <View style={styles.statIcon}><Text style={{ fontSize: 20 }}>🔥</Text></View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: colors.text1 }]}>
                {diasConsecutivos} {diasConsecutivos === 1 ? 'dia' : 'dias'} seguidos
              </Text>
              <Text style={[styles.statDesc, { color: colors.text3 }]}>
                Quantos dias você praticou sem pular nenhum
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statRow}>
            <View style={styles.statIcon}><Text style={{ fontSize: 20 }}>📚</Text></View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: colors.text1 }]}>
                {totalFrases} frases praticadas
              </Text>
              <Text style={[styles.statDesc, { color: colors.text3 }]}>
                Total de frases que você já respondeu
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

          <View style={styles.statRow}>
            <View style={styles.statIcon}><Text style={{ fontSize: 20 }}>🎯</Text></View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: colors.text1 }]}>
                {taxaAcerto}% de acerto
              </Text>
              <Text style={[styles.statDesc, { color: colors.text3 }]}>
                Percentual de frases que você já sabia
              </Text>
            </View>
          </View>
        </View>

        {/* Configurações */}
        <Text style={[styles.sectionTitle, { color: colors.text1 }]}>Configurações</Text>

        {/* Horário */}
        <View style={[styles.settingCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.settingTitle, { color: colors.text1 }]}>
            📱 Horário de notificações
          </Text>
          <Text style={[styles.settingDesc, { color: colors.text3 }]}>
            Você receberá frases para praticar nesse período
          </Text>
          <View style={styles.horariosRow}>
            <View style={styles.horaInput}>
              <TextInput
                style={[styles.horaText, { color: colors.text1, borderColor: colors.border }]}
                value={horaInicio}
                onChangeText={setHoraInicio}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={[styles.horaLabel, { color: colors.text3 }]}>:00</Text>
            </View>
            <Text style={[styles.horaSeparator, { color: colors.text2 }]}>até</Text>
            <View style={styles.horaInput}>
              <TextInput
                style={[styles.horaText, { color: colors.text1, borderColor: colors.border }]}
                value={horaFim}
                onChangeText={setHoraFim}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={[styles.horaLabel, { color: colors.text3 }]}>:00</Text>
            </View>
            <TouchableOpacity
              onPress={handleSaveHorarios}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.saveBtnText}>{saving ? '...' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Switches */}
        <View style={[styles.settingRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.settingRowLabel, { color: colors.text1 }]}>
            {mode === 'dark' ? '🌙' : '☀️'} Tema escuro
          </Text>
          <Switch
            value={mode === 'dark'}
            onValueChange={() => { haptic(); toggleTheme(); }}
            trackColor={{ false: colors.border, true: colors.accent + '60' }}
            thumbColor={mode === 'dark' ? colors.accent : '#ccc'}
          />
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.settingRowLabel, { color: colors.text1 }]}>
            🔊 Áudio de pronúncia
          </Text>
          <Switch
            value={audioEnabled}
            onValueChange={handleToggleAudio}
            trackColor={{ false: colors.border, true: colors.accent + '60' }}
            thumbColor={audioEnabled ? colors.accent : '#ccc'}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: '#EF4444' }]}
        >
          <Text style={[styles.logoutText, { color: '#EF4444' }]}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.text3 }]}>WordFlow v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '800' },
  email: { fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  statsCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 28 },
  statsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  statIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  statInfo: { flex: 1 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statDesc: { fontSize: 12, marginTop: 2 },
  statDivider: { height: 1, marginVertical: 10 },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },

  settingCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  settingTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  settingDesc: { fontSize: 13, marginBottom: 12 },
  horariosRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  horaInput: { flexDirection: 'row', alignItems: 'center' },
  horaText: {
    fontSize: 18, fontWeight: '700', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, width: 50, textAlign: 'center',
  },
  horaLabel: { fontSize: 14, marginLeft: 2 },
  horaSeparator: { fontSize: 14, fontWeight: '600' },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 'auto' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12,
  },
  settingRowLabel: { fontSize: 15, fontWeight: '600' },

  logoutBtn: {
    borderWidth: 1.5, borderRadius: 14, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },

  version: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});