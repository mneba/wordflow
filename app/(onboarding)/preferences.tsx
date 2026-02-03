// app/(onboarding)/preferences.tsx
// Tela 4 do Onboarding: Preferências
// Escolhe horário, ativa notificações, salva tudo no Supabase
// Ao finalizar: marca onboarding_completo = true e redireciona para (tabs)/home

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { PERIOD_LABELS, TRIAL } from '@/constants/config';
import type { UserLevel, UserPeriod } from '@/types';

const PERIODS: { key: UserPeriod; label: string; icon: string; time: string }[] = [
  { key: 'manha', label: 'Manhã', icon: '☀️', time: '8h – 11h' },
  { key: 'almoco', label: 'Almoço', icon: '🌤️', time: '12h – 14h' },
  { key: 'tarde', label: 'Tarde', icon: '🌅', time: '14h – 18h' },
  { key: 'noite', label: 'Noite', icon: '🌙', time: '19h – 22h' },
];

export default function PreferencesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, session, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{
    caderno_id: string;
    nivel_detectado: string;
  }>();

  const [selectedPeriod, setSelectedPeriod] = useState<UserPeriod>('manha');
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const userId = session?.user?.id || user?.id;
      if (!userId) {
        Alert.alert('Erro', 'Sessão não encontrada. Faça login novamente.');
        setSaving(false);
        return;
      }

      const nivel = (params.nivel_detectado || 'basico') as UserLevel;
      const cadernoId = params.caderno_id || null;

      const now = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL.DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Salvar tudo no Supabase
      const { error } = await supabase
        .from('users')
        .update({
          nivel: nivel,
          caderno_ativo_id: cadernoId,
          horario_preferido: selectedPeriod,
          onboarding_completo: true,
          status: 'trial',
          trial_inicio: now.toISOString(),
          trial_fim: trialEnd.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Erro ao salvar preferências:', error);
        Alert.alert('Erro', 'Não foi possível salvar suas preferências. Tente novamente.');
        setSaving(false);
        return;
      }

      // Refresh do perfil no AuthContext
      await refreshProfile();

      // Redirecionar para o app principal
      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('Erro:', e);
      Alert.alert('Erro', 'Algo deu errado. Tente novamente.');
      setSaving(false);
    }
  };

  const nome = user?.nome?.split(' ')[0] || 'Estudante';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.step, { color: colors.accent }]}>Passo 4 de 4</Text>
        <Text style={[styles.title, { color: colors.text1 }]}>
          Quase lá, {nome}! 🎯
        </Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          Quando você prefere praticar?{'\n'}
          Vamos te lembrar no horário certo.
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
        <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.accent }]} />
      </View>

      {/* Períodos */}
      <View style={styles.periodList}>
        {PERIODS.map((period) => {
          const isSelected = selectedPeriod === period.key;
          return (
            <TouchableOpacity
              key={period.key}
              activeOpacity={0.7}
              onPress={() => setSelectedPeriod(period.key)}
              style={[
                styles.periodCard,
                {
                  backgroundColor: isSelected ? colors.accentLight : colors.bgCard,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <Text style={styles.periodIcon}>{period.icon}</Text>
              <View style={styles.periodInfo}>
                <Text style={[styles.periodLabel, { color: colors.text1 }]}>
                  {period.label}
                </Text>
                <Text style={[styles.periodTime, { color: colors.text3 }]}>
                  {period.time}
                </Text>
              </View>
              {isSelected && (
                <View style={[styles.radioOuter, { borderColor: colors.accent }]}>
                  <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />
                </View>
              )}
              {!isSelected && (
                <View style={[styles.radioOuter, { borderColor: colors.text3 }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info card */}
      <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={styles.infoIcon}>✨</Text>
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.text1 }]}>
            Trial de {TRIAL.DURATION_DAYS} dias grátis
          </Text>
          <Text style={[styles.infoDesc, { color: colors.text2 }]}>
            Pratique à vontade durante o período de teste. Sem compromisso.
          </Text>
        </View>
      </View>

      {/* Bottom */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={handleFinish}
          style={[styles.finishBtn, { backgroundColor: colors.accent }]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.finishBtnText}>Começar a praticar 🚀</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.terms, { color: colors.text3 }]}>
          Ao continuar, você concorda com nossos termos de uso.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 4,
  },
  step: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Periods
  periodList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  periodIcon: {
    fontSize: 28,
  },
  periodInfo: {
    flex: 1,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  periodTime: {
    fontSize: 13,
    marginTop: 2,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 28,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
  },
  finishBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  terms: {
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
});
