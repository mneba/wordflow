// app/(onboarding)/preferences.tsx
// Tela 4 do Onboarding: Preferências
// Escolhe horários PROIBIDOS (quando NÃO quer receber), ativa notificações, salva tudo no Supabase
// Ao finalizar: marca onboarding_completo = true e redireciona para (tabs)/home

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';
import { TRIAL } from '@/constants/config';
import type { UserLevel } from '@/types';

type Periodo = 'manha' | 'tarde' | 'noite';

const PERIODS: { key: Periodo; label: string; icon: string; time: string }[] = [
  { key: 'manha', label: 'Manhã', icon: '🌅', time: '7h – 12h' },
  { key: 'tarde', label: 'Tarde', icon: '☀️', time: '12h – 18h' },
  { key: 'noite', label: 'Noite', icon: '🌙', time: '18h – 23h' },
];

const MAX_BLOQUEADOS = 2; // Pode bloquear no máximo 2 (precisa deixar 1 livre)

export default function PreferencesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, session, refreshProfile } = useAuth();
  const params = useLocalSearchParams<{
    caderno_id: string;
    nivel_detectado: string;
  }>();

  const [proibidos, setProibidos] = useState<Periodo[]>([]);
  const [saving, setSaving] = useState(false);

  // Toggle período proibido
  const togglePeriodo = (periodo: Periodo) => {
    setProibidos(prev => {
      if (prev.includes(periodo)) {
        // Remover da lista de proibidos (vai receber nesse horário)
        return prev.filter(p => p !== periodo);
      } else {
        // Adicionar aos proibidos (se não exceder máximo)
        if (prev.length >= MAX_BLOQUEADOS) {
          Alert.alert(
            'Limite atingido',
            'Você precisa deixar pelo menos 1 período livre para receber frases.',
            [{ text: 'Entendi' }]
          );
          return prev;
        }
        return [...prev, periodo];
      }
    });
  };

  // Verificar se período está proibido
  const isProibido = (periodo: Periodo) => proibidos.includes(periodo);

  // Períodos permitidos (para mostrar resumo)
  const periodosPermitidos = PERIODS.filter(p => !proibidos.includes(p.key));

  const handleFinish = async () => {
    if (saving) return;

    if (periodosPermitidos.length === 0) {
      Alert.alert('Erro', 'Você precisa deixar pelo menos 1 período livre.');
      return;
    }

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
          horarios_proibidos: proibidos,
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
          Quando você <Text style={{ fontWeight: '700' }}>não</Text> quer ser interrompido?{'\n'}
          Selecione até 2 períodos para bloquear.
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.bgRaised }]}>
        <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.accent }]} />
      </View>

      {/* Períodos */}
      <View style={styles.periodList}>
        {PERIODS.map((period) => {
          const blocked = isProibido(period.key);
          return (
            <TouchableOpacity
              key={period.key}
              activeOpacity={0.7}
              onPress={() => togglePeriodo(period.key)}
              style={[
                styles.periodCard,
                {
                  backgroundColor: blocked ? colors.roseLight : colors.bgCard,
                  borderColor: blocked ? colors.rose : colors.border,
                  borderWidth: blocked ? 2 : 1,
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
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: blocked ? colors.rose : 'transparent',
                  borderColor: blocked ? colors.rose : colors.text3,
                },
              ]}>
                {blocked && (
                  <Text style={styles.checkboxX}>✕</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Resumo */}
      <View style={[styles.resumoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.resumoLabel, { color: colors.text3 }]}>
          Você receberá frases:
        </Text>
        {periodosPermitidos.length > 0 ? (
          <Text style={[styles.resumoText, { color: colors.green }]}>
            {periodosPermitidos.map(p => `${p.icon} ${p.label}`).join('  •  ')}
          </Text>
        ) : (
          <Text style={[styles.resumoText, { color: colors.rose }]}>
            Nenhum período disponível!
          </Text>
        )}
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
          disabled={saving || periodosPermitidos.length === 0}
          onPress={handleFinish}
          style={[
            styles.finishBtn,
            { backgroundColor: colors.accent },
            periodosPermitidos.length === 0 && { opacity: 0.5 },
          ]}
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxX: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Resumo
  resumoCard: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  resumoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  resumoText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
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