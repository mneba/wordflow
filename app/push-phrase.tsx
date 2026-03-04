// app/push-phrase.tsx
// Tela dedicada para responder frase vinda de push notification
// Fora das tabs - sem tab bar, experiência focada
// Fluxo: push → abre → vê frase → responde → feedback → fecha

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const haptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

type Estado = 'loading' | 'pergunta' | 'feedback' | 'erro';

interface FraseData {
  frase_id: string;
  frase: string;
  traducao: string;
  explicacao: string | null;
  audio_url: string | null;
  estado: string;
  controle_envio_id: string;
  ordem: number;
  total: number;
}

export default function PushPhraseScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessao_id?: string;
    frase_id?: string;
    controle_envio_id?: string;
    ordem?: string;
    total?: string;
  }>();

  const [estado, setEstado] = useState<Estado>('loading');
  const [frase, setFrase] = useState<FraseData | null>(null);
  const [respondeu, setRespondeu] = useState<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animações
  const cardScale = useSharedValue(0.95);
  const feedbackOpacity = useSharedValue(0);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const feedbackAnimStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
  }));

  // Carregar frase
  useEffect(() => {
    loadFrase();
  }, []);

  const loadFrase = async () => {
    try {
      const fraseId = params.frase_id;
      const controleId = params.controle_envio_id;

      if (!fraseId || !user?.id) {
        setEstado('erro');
        return;
      }

      // Buscar dados da frase
      let fraseData: any = null;

      // Tentar tabela frases
      const { data: f1 } = await supabase
        .from('frases')
        .select('id, frase, traducao, explicacao, audio_url')
        .eq('id', fraseId)
        .single();

      if (f1) {
        fraseData = f1;
      } else {
        // Tentar frases_tematicos
        const { data: f2 } = await supabase
          .from('frases_tematicos')
          .select('id, frase, traducao, explicacao, audio_url')
          .eq('id', fraseId)
          .single();
        fraseData = f2;
      }

      if (!fraseData) {
        setEstado('erro');
        return;
      }

      // Buscar estado do controle_envios
      let controleData: any = null;
      if (controleId) {
        const { data: ce } = await supabase
          .from('controle_envios')
          .select('id, estado')
          .eq('id', controleId)
          .single();
        controleData = ce;
      }

      setFrase({
        frase_id: fraseData.id,
        frase: fraseData.frase,
        traducao: fraseData.traducao,
        explicacao: fraseData.explicacao,
        audio_url: fraseData.audio_url,
        estado: controleData?.estado || 'nova',
        controle_envio_id: controleId || '',
        ordem: parseInt(params.ordem || '1'),
        total: parseInt(params.total || '5'),
      });

      cardScale.value = withSpring(1, { damping: 12 });
      setEstado('pergunta');
    } catch (err) {
      console.error('Erro ao carregar frase:', err);
      setEstado('erro');
    }
  };

  // Responder frase
  const responder = async (sabe: boolean) => {
    if (!frase || !user?.id) return;
    haptic(sabe ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);

    setRespondeu(sabe);
    feedbackOpacity.value = withTiming(1, { duration: 300 });
    setEstado('feedback');

    try {
      // Atualizar controle_envios
      if (frase.controle_envio_id) {
        const now = new Date().toISOString();
        const proximaRevisao = calcularProximaRevisao(sabe);

        await supabase
          .from('controle_envios')
          .update({
            sabe,
            data_resposta: now,
            proxima_revisao: proximaRevisao,
            estado: sabe ? 'confirmacao' : 'aprendendo',
          })
          .eq('id', frase.controle_envio_id);
      }

      // Atualizar métricas do usuário
      const updates: any = {
        total_frases_vistas: (user.total_frases_vistas || 0) + 1,
        ultima_interacao: new Date().toISOString(),
      };
      if (sabe) {
        updates.total_frases_corretas = (user.total_frases_corretas || 0) + 1;
      }
      await supabase.from('users').update(updates).eq('id', user.id);
    } catch (err) {
      console.error('Erro ao salvar resposta:', err);
    }
  };

  const calcularProximaRevisao = (sabe: boolean): string => {
    const agora = new Date();
    const dias = sabe ? 3 : 1; // simplificado - primeira revisão
    agora.setDate(agora.getDate() + dias);
    return agora.toISOString();
  };

  // Áudio
  const playAudio = async () => {
    if (!frase) return;
    haptic(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
      return;
    }

    let audioUrl = frase.audio_url;

    if (!audioUrl) {
      setIsGeneratingAudio(true);
      try {
        const response = await supabase.functions.invoke('gerar-audio', {
          body: { frase_id: frase.frase_id, texto: frase.frase },
        });
        if (response.data?.success && response.data?.audio_url) {
          audioUrl = response.data.audio_url;
          setFrase(prev => prev ? { ...prev, audio_url: audioUrl! } : null);
        }
      } catch (err) {
        console.error('Erro ao gerar áudio:', err);
      }
      setIsGeneratingAudio(false);
    }

    if (!audioUrl) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error('Erro áudio:', err);
      setIsPlaying(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  // Fechar e voltar
  const fechar = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/');
    }
  };

  // Ir para sessão completa
  const praticarMais = () => {
    haptic();
    router.replace('/(tabs)/praticar');
  };

  // ═══════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════
  if (estado === 'loading') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ═══════════════════════════════════════
  // ERRO
  // ═══════════════════════════════════════
  if (estado === 'erro') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
        <Text style={[styles.erroText, { color: colors.text1 }]}>
          Não foi possível carregar a frase
        </Text>
        <TouchableOpacity onPress={fechar} style={[styles.fecharBtn, { backgroundColor: colors.accent }]}>
          <Text style={styles.fecharBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══════════════════════════════════════
  // FRASE (pergunta ou feedback)
  // ═══════════════════════════════════════
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerLabel, { color: colors.text3 }]}>
          Frase {frase?.ordem || 1} de {frase?.total || 5}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Indicador de estado */}
      {frase?.estado && frase.estado !== 'nova' && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.accent + '15' }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {frase.estado === 'aprendendo' ? '🔄 Revisão' :
               frase.estado === 'confirmacao' ? '✓ Confirmação' :
               frase.estado === 'manutencao' ? '💎 Manutenção' : ''}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Card da frase */}
      <Animated.View style={[styles.cardArea, cardAnimStyle]}>
        <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
          <Text style={[styles.fraseText, { color: colors.text1 }]}>
            {frase?.frase}
          </Text>

          {/* Botão áudio */}
          <TouchableOpacity
            onPress={playAudio}
            disabled={isGeneratingAudio}
            style={[styles.audioBtn, {
              backgroundColor: isPlaying ? colors.accent : colors.bgRaised,
              borderColor: isPlaying ? colors.accent : colors.border,
            }]}
          >
            {isGeneratingAudio ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>{isPlaying ? '⏸' : '🔊'}</Text>
                <Text style={[styles.audioBtnText, { color: isPlaying ? '#fff' : colors.text2 }]}>
                  {isPlaying ? 'Pausar' : 'Ouvir'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Feedback — tradução + explicação */}
          {estado === 'feedback' && (
            <Animated.View style={[styles.feedbackArea, feedbackAnimStyle]}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <Text style={[styles.feedbackEmoji]}>
                {respondeu ? '✅' : '📘'}
              </Text>
              <Text style={[styles.feedbackMsg, { color: respondeu ? colors.green : colors.sky }]}>
                {respondeu ? 'Você já conhece essa!' : 'Anotado para revisar!'}
              </Text>

              <Text style={[styles.traducaoLabel, { color: colors.text3 }]}>Tradução</Text>
              <Text style={[styles.traducaoText, { color: colors.text1 }]}>
                {frase?.traducao}
              </Text>

              {frase?.explicacao && (
                <Text style={[styles.explicacaoText, { color: colors.text2 }]}>
                  {frase.explicacao}
                </Text>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {/* Botões */}
      <View style={styles.bottomArea}>
        {estado === 'pergunta' ? (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={() => responder(false)}
              style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.rose, borderWidth: 2 }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>🤔</Text>
              <Text style={[styles.actionBtnText, { color: colors.rose }]}>Não sei</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => responder(true)}
              style={[styles.actionBtn, { backgroundColor: colors.green }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>✓</Text>
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Sei</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.feedbackButtons}>
            {/* Botão principal: Praticar mais */}
            <TouchableOpacity
              onPress={praticarMais}
              style={[styles.praticarMaisBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.7}
            >
              <Text style={styles.praticarMaisText}>Praticar mais</Text>
              <Text style={styles.praticarMaisArrow}>→</Text>
            </TouchableOpacity>

            {/* Botão secundário: Fechar */}
            <TouchableOpacity onPress={fechar} style={styles.fecharLink} activeOpacity={0.7}>
              <Text style={[styles.fecharLinkText, { color: colors.text3 }]}>
                Fechar · próxima frase em breve
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 22, fontWeight: '300' },
  headerLabel: { fontSize: 13, fontWeight: '600' },

  // Badge
  badgeRow: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  // Card
  cardArea: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  fraseText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 34,
  },

  // Áudio
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  audioBtnText: { fontSize: 14, fontWeight: '600' },

  // Feedback
  feedbackArea: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  divider: { height: 1, width: '100%', marginBottom: 20 },
  feedbackEmoji: { fontSize: 32, marginBottom: 8 },
  feedbackMsg: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  traducaoLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  traducaoText: { fontSize: 18, fontWeight: '500', textAlign: 'center', marginBottom: 8 },
  explicacaoText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },

  // Botões — pergunta
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  actionBtnText: { fontSize: 17, fontWeight: '700' },

  // Botões — feedback
  feedbackButtons: {
    gap: 12,
  },
  praticarMaisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  praticarMaisText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  praticarMaisArrow: { fontSize: 18, color: '#fff' },
  fecharLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  fecharLinkText: { fontSize: 14 },

  // Erro
  erroText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  fecharBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  fecharBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
