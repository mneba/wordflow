// app/(tabs)/notebooks.tsx
// Cadernos — títulos completos, botão ativar/ativado, palavras únicas

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };

interface CadernoComProgresso {
  id: string; nome: string; tipo: string; icone: string | null;
  cor: string | null; total_frases: number; palavras_unicas_estimadas: number;
  descricao: string | null; frases_vistas: number; frases_dominadas: number; progresso: number;
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
        .eq('status', 'ativo').order('tipo').order('nome');
      if (!cadernosData) return;

      const { data: progressoData } = await supabase
        .from('controle_envios')
        .select('frase_id, estado, caderno_id')
        .eq('user_id', user.id).not('sabe', 'is', null);

      const progMap = new Map<string, { vistas: number; dominadas: number }>();
      if (progressoData) {
        for (const item of progressoData) {
          const cid = item.caderno_id || 'sem';
          const c = progMap.get(cid) || { vistas: 0, dominadas: 0 };
          c.vistas++;
          if (item.estado === 'dominada' || item.estado === 'manutencao') c.dominadas++;
          progMap.set(cid, c);
        }
      }

      setCadernos(cadernosData.map((c) => {
        const p = progMap.get(c.id) || { vistas: 0, dominadas: 0 };
        return { ...c, palavras_unicas_estimadas: c.palavras_unicas_estimadas || 0,
          frases_vistas: p.vistas, frases_dominadas: p.dominadas,
          progresso: c.total_frases > 0 ? Math.round((p.vistas / c.total_frases) * 100) : 0 };
      }));
    } catch (err) { console.error('Erro cadernos:', err); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchCadernos(); }, [fetchCadernos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchCadernos(); setRefreshing(false);
  }, [fetchCadernos]);

  const handleTrocarCaderno = useCallback(async (caderno: CadernoComProgresso) => {
    if (caderno.id === cadernoAtivoId || !user?.id) return;
    haptic(); setSwitching(caderno.id);
    try {
      const { error } = await supabase.from('users').update({ caderno_ativo_id: caderno.id }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      if (Platform.OS !== 'web') Alert.alert('✅ Caderno ativado', `Agora: ${caderno.nome}`);
    } catch { if (Platform.OS !== 'web') Alert.alert('Erro', 'Não foi possível trocar.'); }
    finally { setSwitching(null); }
  }, [cadernoAtivoId, user?.id, refreshProfile]);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
        <Text style={[styles.title, { color: colors.text1 }]}>Cadernos</Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>Escolha o tema que você quer praticar</Text>

        {cadernos.map((caderno) => {
          const isAtivo = caderno.id === cadernoAtivoId;
          const isAtivando = switching === caderno.id;
          return (
            <TouchableOpacity key={caderno.id} activeOpacity={isAtivo ? 1 : 0.7}
              onPress={() => !isAtivo && handleTrocarCaderno(caderno)} disabled={isAtivo || isAtivando}
              style={[styles.card, {
                backgroundColor: isAtivo ? colors.accent + '10' : colors.bgCard,
                borderColor: isAtivo ? colors.accent : colors.border,
                borderWidth: isAtivo ? 2 : 1,
              }]}>
              {/* Ícone */}
              <View style={[styles.iconBg, { backgroundColor: colors.accent + '15' }]}>
                <Text style={styles.icon}>{caderno.icone || '📖'}</Text>
              </View>

              {/* Info — ocupa toda a largura, botão abaixo */}
              <View style={styles.infoArea}>
                <View style={styles.nameRow}>
                  <Text style={[styles.nome, { color: colors.text1 }]}>{caderno.nome}</Text>
                  {isAtivo && (
                    <View style={[styles.ativoBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.ativoBadgeText}>ATIVO</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.meta, { color: colors.text3 }]}>
                  {caderno.total_frases} frases · ~{caderno.palavras_unicas_estimadas} palavras únicas
                </Text>

                <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${Math.min(caderno.progresso, 100)}%`, backgroundColor: colors.accent }]} />
                </View>

                <View style={styles.bottomRow}>
                  <Text style={[styles.progressLabel, { color: colors.text3 }]}>
                    {caderno.frases_vistas} vistas · {caderno.frases_dominadas} dominadas · {caderno.progresso}%
                  </Text>

                  <View style={[styles.actionBtn, isAtivo
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: 'transparent', borderColor: colors.accent }]}>
                    {isAtivando ? <ActivityIndicator size="small" color={colors.accent} />
                      : <Text style={[styles.actionText, { color: isAtivo ? '#fff' : colors.accent }]}>
                          {isAtivo ? 'Ativado ✓' : 'Ativar'}
                        </Text>}
                  </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 24 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start' },
  iconBg: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  icon: { fontSize: 24 },

  infoArea: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  nome: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  ativoBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ativoBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  meta: { fontSize: 12, marginBottom: 8 },

  progressBg: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 4, borderRadius: 2 },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 11, flex: 1 },

  actionBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, minWidth: 76, alignItems: 'center' },
  actionText: { fontSize: 12, fontWeight: '700' },
});
