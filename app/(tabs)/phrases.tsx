// app/(tabs)/phrases.tsx
// Minhas Frases — lista de frases já praticadas, com estado e áudio

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

type EstadoFiltro = 'todas' | 'dominada' | 'aprendendo' | 'nova';

interface FrasePraticada {
  controle_id: string;
  frase_id: string;
  frase: string;
  traducao: string;
  explicacao: string | null;
  audio_url: string | null;
  estado: string;
  repeticoes: number;
  proxima_revisao: string | null;
  data_resposta: string | null;
}

const ESTADO_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  nova: { label: 'Nova', emoji: '🆕', color: '#6BB8F0' },
  confirmacao: { label: 'Confirmação', emoji: '✓', color: '#F5C563' },
  aprendendo: { label: 'Aprendendo', emoji: '🔄', color: '#8B7CF7' },
  dominada: { label: 'Dominada', emoji: '🏆', color: '#5EEEA0' },
  manutencao: { label: 'Manutenção', emoji: '💎', color: '#5EEEA0' },
};

export default function PhrasesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [frases, setFrases] = useState<FrasePraticada[]>([]);
  const [filtro, setFiltro] = useState<EstadoFiltro>('todas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const fetchFrases = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Buscar controle_envios com frases já respondidas
      const { data: controles } = await supabase
        .from('controle_envios')
        .select('id, frase_id, estado, repeticoes, proxima_revisao, data_resposta')
        .eq('user_id', user.id)
        .not('sabe', 'is', null)
        .order('data_resposta', { ascending: false });

      if (!controles || controles.length === 0) {
        setFrases([]);
        setLoading(false);
        return;
      }

      // Deduplicate por frase_id (manter o mais recente)
      const uniqueMap = new Map<string, any>();
      for (const c of controles) {
        if (!uniqueMap.has(c.frase_id)) {
          uniqueMap.set(c.frase_id, c);
        }
      }
      const uniqueControles = Array.from(uniqueMap.values());
      const fraseIds = uniqueControles.map(c => c.frase_id);

      // Buscar dados das frases (tabela frases)
      const { data: frasesData } = await supabase
        .from('frases')
        .select('id, frase, traducao, explicacao, audio_url')
        .in('id', fraseIds);

      // Buscar também em frases_tematicos
      const { data: frasesTemData } = await supabase
        .from('frases_tematicos')
        .select('id, frase, traducao, explicacao, audio_url')
        .in('id', fraseIds);

      const fraseMap = new Map<string, any>();
      if (frasesData) frasesData.forEach(f => fraseMap.set(f.id, f));
      if (frasesTemData) frasesTemData.forEach(f => fraseMap.set(f.id, f));

      const resultado: FrasePraticada[] = uniqueControles
        .map(c => {
          const f = fraseMap.get(c.frase_id);
          if (!f) return null;
          return {
            controle_id: c.id,
            frase_id: c.frase_id,
            frase: f.frase,
            traducao: f.traducao,
            explicacao: f.explicacao,
            audio_url: f.audio_url,
            estado: c.estado || 'nova',
            repeticoes: c.repeticoes || 0,
            proxima_revisao: c.proxima_revisao,
            data_resposta: c.data_resposta,
          };
        })
        .filter(Boolean) as FrasePraticada[];

      setFrases(resultado);
    } catch (err) {
      console.error('Erro ao buscar frases:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchFrases(); }, [fetchFrases]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFrases();
    setRefreshing(false);
  }, [fetchFrases]);

  // Filtrar
  const frasesFiltradas = frases.filter(f => {
    if (filtro === 'todas') return true;
    if (filtro === 'dominada') return f.estado === 'dominada' || f.estado === 'manutencao';
    if (filtro === 'aprendendo') return f.estado === 'aprendendo' || f.estado === 'confirmacao';
    if (filtro === 'nova') return f.estado === 'nova';
    return true;
  });

  // Contadores
  const contadores = {
    todas: frases.length,
    dominada: frases.filter(f => f.estado === 'dominada' || f.estado === 'manutencao').length,
    aprendendo: frases.filter(f => f.estado === 'aprendendo' || f.estado === 'confirmacao').length,
    nova: frases.filter(f => f.estado === 'nova').length,
  };

  // Áudio
  const playAudio = useCallback(async (frase: FrasePraticada) => {
    haptic();

    // Parar áudio anterior
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (playingId === frase.frase_id) {
      setPlayingId(null);
      return;
    }

    let audioUrl = frase.audio_url;

    // Se não tem áudio, gerar
    if (!audioUrl) {
      setGeneratingId(frase.frase_id);
      try {
        const response = await supabase.functions.invoke('gerar-audio', {
          body: { frase_id: frase.frase_id, texto: frase.frase },
        });
        if (response.data?.success && response.data?.audio_url) {
          audioUrl = response.data.audio_url;
          // Atualizar no state local
          setFrases(prev => prev.map(f =>
            f.frase_id === frase.frase_id ? { ...f, audio_url: audioUrl! } : f
          ));
        }
      } catch (err) {
        console.error('Erro ao gerar áudio:', err);
      } finally {
        setGeneratingId(null);
      }
    }

    if (!audioUrl) return;

    try {
      setPlayingId(frase.frase_id);
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error('Erro ao tocar áudio:', err);
      setPlayingId(null);
    }
  }, [playingId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const toggleExpand = (id: string) => {
    haptic();
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderFrase = ({ item }: { item: FrasePraticada }) => {
    const config = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG.nova;
    const isExpanded = expandedId === item.controle_id;
    const isPlaying = playingId === item.frase_id;
    const isGenerating = generatingId === item.frase_id;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleExpand(item.controle_id)}
        style={[styles.fraseCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        <View style={styles.fraseHeader}>
          <View style={styles.fraseMain}>
            <Text style={[styles.fraseText, { color: colors.text1 }]} numberOfLines={isExpanded ? undefined : 2}>
              {item.frase}
            </Text>
            <View style={[styles.estadoBadge, { backgroundColor: config.color + '20' }]}>
              <Text style={[styles.estadoLabel, { color: config.color }]}>
                {config.emoji} {config.label}
              </Text>
            </View>
          </View>

          {/* Botão áudio */}
          <TouchableOpacity
            onPress={() => playAudio(item)}
            style={[styles.audioBtn, {
              backgroundColor: isPlaying ? colors.accent : colors.bgRaised,
            }]}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={{ fontSize: 18 }}>
                {isPlaying ? '⏸' : '🔊'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Expandido: tradução e detalhes */}
        {isExpanded && (
          <View style={[styles.expandedArea, { borderTopColor: colors.border }]}>
            <Text style={[styles.traducao, { color: colors.text2 }]}>
              {item.traducao}
            </Text>
            {item.explicacao && (
              <Text style={[styles.explicacao, { color: colors.text3 }]}>
                {item.explicacao}
              </Text>
            )}
            <View style={styles.detailsRow}>
              <Text style={[styles.detailText, { color: colors.text3 }]}>
                {item.repeticoes}x praticada
              </Text>
              {item.proxima_revisao && (
                <Text style={[styles.detailText, { color: colors.text3 }]}>
                  Revisão: {new Date(item.proxima_revisao).toLocaleDateString('pt-BR')}
                </Text>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={[styles.title, { color: colors.text1 }]}>Minhas Frases</Text>
        <Text style={[styles.subtitle, { color: colors.text2 }]}>
          {frases.length} {frases.length === 1 ? 'frase praticada' : 'frases praticadas'}
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtroRow}>
        {([
          { key: 'todas' as EstadoFiltro, label: 'Todas' },
          { key: 'dominada' as EstadoFiltro, label: '🏆 Dominadas' },
          { key: 'aprendendo' as EstadoFiltro, label: '🔄 Aprendendo' },
          { key: 'nova' as EstadoFiltro, label: '🆕 Novas' },
        ]).map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => { haptic(); setFiltro(f.key); }}
            style={[
              styles.filtroChip,
              {
                backgroundColor: filtro === f.key ? colors.accent : colors.bgCard,
                borderColor: filtro === f.key ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[
              styles.filtroText,
              { color: filtro === f.key ? '#fff' : colors.text2 },
            ]}>
              {f.label} ({contadores[f.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {frasesFiltradas.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={[styles.emptyTitle, { color: colors.text1 }]}>
            {filtro === 'todas' ? 'Nenhuma frase praticada ainda' : 'Nenhuma frase neste estado'}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.text3 }]}>
            {filtro === 'todas' ? 'Inicie uma sessão para começar!' : 'Continue praticando!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={frasesFiltradas}
          renderItem={renderFrase}
          keyExtractor={item => item.controle_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerArea: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },

  // Filtros
  filtroRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    gap: 8, flexWrap: 'wrap',
  },
  filtroChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  filtroText: { fontSize: 12, fontWeight: '600' },

  // Lista
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // Card frase
  fraseCard: {
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1,
  },
  fraseHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  fraseMain: { flex: 1, marginRight: 10 },
  fraseText: { fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 6 },
  estadoBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  estadoLabel: { fontSize: 11, fontWeight: '700' },

  audioBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },

  // Expandido
  expandedArea: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  traducao: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  explicacao: { fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  detailsRow: { flexDirection: 'row', gap: 16 },
  detailText: { fontSize: 11 },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
