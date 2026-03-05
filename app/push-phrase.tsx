// app/push-phrase.tsx
// V4 - Tela dedicada para push notification
// Frase única → responde → feedback → fecha ou pratica mais

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

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

      let fraseData: any = null;

      const { data: f1 } = await supabase
        .from('frases')
        .select('id, frase, traducao, explicacao, audio_url')
        .eq('id', fraseId)
        .single();

      if (f1) {
        fraseData = f1;
      } else {
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
      });

      cardScale.value = withSpring(1, { damping: 12 });
      setEstado('pergunta');
    } catch (err) {
      console.error('Erro ao carregar frase:', err);
      setEstado('erro');
    }
  };

  // Responder
  const responder = async (sabe: boolean) => {
    if (!frase || !user?.id) return;
    haptic(sabe ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);

    setRespondeu(sabe);
    feedbackOpacity.value = withTiming(1, { duration: 300 });
    setEstado('feedback');

    try {
      if (frase.controle_envio_id) {
        const now = new Date().toISOString();
        const dias = sabe ? 3 : 1;
        const prox = new Date();
        prox.setDate(prox.getDate() + dias);

        await supabase
          .from('controle_envios')
          .update({
            sabe,
            data_resposta: now,
            proxima_revisao: prox.toISOString(),
            estado: sabe ? 'confirmacao' : 'aprendendo',
          })
          .eq('id', frase.controle_envio_id);
      }

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
      if (soundRef.current) await soundRef.current.unloadAsync();
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
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

  useEffect(() => {
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, []);

  // Fechar → volta pra home
  const fechar = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/');
    }
  };

  // Fechar app
  const fecharApp = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      fechar();
    }
  };

  // Praticar mais
  const praticarMais = () => {
    haptic();
    router.replace('/(tabs)/praticar');
  };

  // ═══════════ LOADING ═══════════
  if (estado === 'loading') {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ═══════════ ERRO ═══════════
  if (estado === 'erro') {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
        <Text style={[styles.erroText, { color: colors.text1 }]}>
          Não foi possível carregar a frase
        </Text>
        <TouchableOpacity onPress={fechar} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
          <Text style={styles.btnPrimaryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══════════ FRASE ═══════════
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerLabel, { color: colors.accent, fontWeight: '700' }]}>WordFlow</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Conteúdo com scroll */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <Animated.View style={[styles.cardArea, cardAnimStyle]}>
          <View style={[styles.card, { backgroundColor: colors.bgCard }]}>

            {/* Badge dentro do card */}
            {frase?.estado && frase.estado !== 'nova' && (
              <View style={[styles.badge, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>
                  {frase.estado === 'aprendendo' ? '🔄 Revisão' :
                   frase.estado === 'confirmacao' ? '✓ Confirmação' :
                   frase.estado === 'manutencao' ? '💎 Manutenção' : '🆕 Nova'}
                </Text>
              </View>
            )}

            {/* Frase */}
            <Text style={[styles.fraseText, { color: colors.text1 }]}>
              {frase?.frase}
            </Text>

            {/* Áudio */}
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
                    {isPlaying ? 'Pausar' : 'Ouvir pronúncia'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Feedback */}
            {estado === 'feedback' && (
              <Animated.View style={[styles.feedbackArea, feedbackAnimStyle]}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <Text style={styles.feedbackEmoji}>
                  {respondeu ? '✅' : '📘'}
                </Text>
                <Text style={[styles.feedbackMsg, { color: respondeu ? colors.green : colors.sky }]}>
                  {respondeu ? 'Você já conhece essa!' : 'Anotado para revisar!'}
                </Text>

                <View style={[styles.traducaoBox, { backgroundColor: colors.bgRaised }]}>
                  <Text style={[styles.traducaoLabel, { color: colors.text3 }]}>TRADUÇÃO</Text>
                  <Text style={[styles.traducaoText, { color: colors.text1 }]}>
                    {frase?.traducao}
                  </Text>
                  {frase?.explicacao && (
                    <Text style={[styles.explicacaoText, { color: colors.text2 }]}>
                      {frase.explicacao}
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Botões fixos no bottom */}
      <View style={[styles.bottomArea, { borderTopColor: colors.border }]}>
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
            {/* Praticar mais */}
            <TouchableOpacity
              onPress={praticarMais}
              style={[styles.btnPrimary, { backgroundColor: colors.accent }]}
              activeOpacity={0.7}
            >
              <Text style={styles.btnPrimaryText}>Praticar mais  →</Text>
            </TouchableOpacity>

            {/* Fechar app */}
            <TouchableOpacity
              onPress={fecharApp}
              style={[styles.btnSecondary, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.text2 }]}>Fechar aplicativo</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 22, fontWeight: '300' },
  headerLabel: { fontSize: 16 },

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },

  // Card
  cardArea: { paddingHorizontal: 20 },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  // Badge (dentro do card, flow normal)
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },

  // Frase
  fraseText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
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
  feedbackArea: { width: '100%', alignItems: 'center', marginTop: 20 },
  divider: { height: 1, width: '100%', marginBottom: 20 },
  feedbackEmoji: { fontSize: 32, marginBottom: 8 },
  feedbackMsg: { fontSize: 16, fontWeight: '700', marginBottom: 16 },

  traducaoBox: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
  },
  traducaoLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  traducaoText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
  },
  explicacaoText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Bottom area
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  buttonsRow: { flexDirection: 'row', gap: 12 },
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

  // Feedback buttons
  feedbackButtons: { gap: 10 },
  btnPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  btnPrimaryText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },

  // Erro
  erroText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
});