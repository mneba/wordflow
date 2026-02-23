// app/(tabs)/notebooks.tsx
// Cadernos — todos na lista, ativo marcado com "Ativado ✓", palavras únicas

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

interface CadernoComProgresso {
  id: string;
  nome: string;
  tipo: string;
  icone: string | null;
  cor: string | null;
  total_frases: number;
  palavras_unicas_estimadas: number;
  descricao: string | null;
  frases_vistas: number;
  frases_dominadas: number;
  progresso: number;
}

export default function NotebooksScreen() {
  const { colors } = useTheme();
  const { user, refreshProfile } = useAuth();
  const [cadernos, setCadernos] = useState<CadernoComProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const cadernoAtivoId = user?.caderno_ativo_id;

  const fetchCadernos = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: cadernosData } = await supabase
        .from('cadernos')
        .select('id, nome, tipo, icone, cor, total_frases, palavras_unicas_estimadas, descricao')
        .eq('status', 'ativo')
        .order('tipo')
        .order('nome');

      if (!cadernosData) return;

      const { data: progressoData } = await supabase
        .from('controle_envios')
        .select('frase_id, estado, caderno_id')
        .eq('user_id', user.id)
        .not('sabe', 'is', null);

      const progressoPorCaderno = new Map<string, { vistas: number; dominadas: number }>();

      if (progressoData) {
        for (const item of progressoData) {
          const cid = item.caderno_id || 'sem_caderno';
          const current = progressoPorCaderno.get(cid) || { vistas: 0, dominadas: 0 };
          current.vistas++;
          if (item.estado === 'dominada' || item.estado === 'manutencao') {
            current.dominadas++;
          }
          progressoPorCaderno.set(cid, current);
        }
      }

      const result: CadernoComProgresso[] = cadernosData.map((c) => {
        const prog = progressoPorCaderno.get(c.id) || { vistas: 0, dominadas: 0 };
        return {
          ...c,
          palavras_unicas_estimadas: c.palavras_unicas_estimadas || 0,
          frases_vistas: prog.vistas,
          frases_dominadas: prog.dominadas,
          progresso: c.total_frases > 0
            ? Math.round((prog.vistas / c.total_frases) * 100)
            : 0,
        };
      });

      setCadernos(result);
    } catch (err) {
      console.error('Erro ao buscar cadernos:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCadernos();
  }, [fetchCadernos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCadernos();
    setRefreshing(false);
  }, [fetchCadernos]);

  const handleTrocarCaderno = useCallback(async (caderno: CadernoComProgresso) => {
    if (caderno.id === cadernoAtivoId) return;
    if (!user?.id) return;

    haptic();
    setSwitching(caderno.id);

    try {
      const { error } = await supabase
        .from('users')
        .update({ caderno_ativo_id: caderno.id })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();

      if (Platform.OS !== 'web') {
        Alert.alert('✅ Caderno ativado', `Agora você está praticando: ${caderno.nome}`);
      }
    } catch (err) {
      console.error('Erro ao trocar caderno:', err);
      if (Platform.OS !== 'web') {
        Alert.alert('Erro', 'Não foi possível trocar o caderno.');
      }
    } finally {
      setSwitching(null);
    }
  }, [cadernoAtivoId, user?.id, refreshProfile]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <Text style={[styles.title, { color: colors.text1 }]}>Cadernos</Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          Escolha o tema que você quer praticar
        </Text>

        {/* Lista de cadernos — todos aparecem, ativo fica marcado */}
        {cadernos.map((caderno) => {
          const isAtivo = caderno.id === cadernoAtivoId;
          const isAtivando = switching === caderno.id;

          return (
            <TouchableOpacity
              key={caderno.id}
              activeOpacity={isAtivo ? 1 : 0.7}
              onPress={() => !isAtivo && handleTrocarCaderno(caderno)}
              disabled={isAtivo || isAtivando}
              style={[
                styles.cadernoCard,
                {
                  backgroundColor: isAtivo ? colors.accent + '10' : colors.bgCard,
                  borderColor: isAtivo ? colors.accent : colors.border,
                  borderWidth: isAtivo ? 2 : 1,
                },
              ]}
            >
              <View style={styles.cadernoRow}>
                {/* Ícone */}
                <View style={[styles.cadernoIconBg, { backgroundColor: colors.accent + '15' }]}>
                  <Text style={styles.cadernoIcon}>{caderno.icone || '📖'}</Text>
                </View>

                {/* Info */}
                <View style={styles.cadernoInfo}>
                  <View style={styles.cadernoNameRow}>
                    <Text
                      style={[styles.cadernoNome, { color: colors.text1 }]}
                      numberOfLines={1}
                    >
                      {caderno.nome}
                    </Text>
                    {isAtivo && (
                      <View style={[styles.ativoBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.ativoBadgeText}>ATIVO</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.cadernoMeta, { color: colors.text3 }]}>
                    {caderno.total_frases} frases · ~{caderno.palavras_unicas_estimadas} palavras únicas
                  </Text>

                  {/* Mini barra de progresso */}
                  <View style={[styles.miniProgressBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.miniProgressFill,
                        {
                          width: `${Math.min(caderno.progresso, 100)}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: colors.text3 }]}>
                    {caderno.frases_vistas} vistas · {caderno.frases_dominadas} dominadas · {caderno.progresso}%
                  </Text>
                </View>

                {/* Botão */}
                <View
                  style={[
                    styles.actionBtn,
                    isAtivo
                      ? { backgroundColor: colors.accent, borderColor: colors.accent }
                      : { backgroundColor: 'transparent', borderColor: colors.accent },
                  ]}
                >
                  {isAtivando ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : isAtivo ? (
                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>Ativado ✓</Text>
                  ) : (
                    <Text style={[styles.actionBtnText, { color: colors.accent }]}>Ativar</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },

  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 },

  // Card caderno
  cadernoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cadernoRow: { flexDirection: 'row', alignItems: 'center' },
  cadernoIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cadernoIcon: { fontSize: 24 },
  cadernoInfo: { flex: 1 },
  cadernoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cadernoNome: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  ativoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ativoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cadernoMeta: { fontSize: 12, marginBottom: 6 },
  miniProgressBg: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  miniProgressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 11 },

  actionBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
});
