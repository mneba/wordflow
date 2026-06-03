// app/push-phrase.tsx
// V5 - Verifica se já respondeu, usa responder-frase-app
// Fora das tabs, sem tab bar

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, ScrollView, BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/services/supabase';

const haptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

type Estado = 'loading' | 'pergunta' | 'feedback' | 'ja_respondeu' | 'erro';

interface FraseData {
  frase_id: string;
  frase: string;
  traducao: string;
  explicacao: string | null;
  audio_url: string | null;
  estado_atual: string | null;
}

export default function PushPhraseScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    frase_id?: string;
    sessao_id?: string;
  }>();

  const [estado, setEstado] = useState<Estado>('loading');
  const [frase, setFrase] = useState<FraseData | null>(null);
  const [respondeu, setRespondeu] = useState<boolean | null>(null);
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [fraseInfo, setFraseInfo] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [processando, setProcessando] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const cardScale = useSharedValue(0.95);
  const feedbackOpacity = useSharedValue(0);
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const feedbackAnimStyle = useAnimatedStyle(() => ({ opacity: feedbackOpacity.value }));

  useEffect(() => { loadFrase(); }, []);

  const loadFrase = async () => {
    try {
      const fraseId = params.frase_id;
      if (!fraseId || !user?.id) { setEstado('erro'); return; }

      // Buscar dados da frase
      let fraseData: any = null;
      const { data: f1 } = await supabase.from('frases')
        .select('id, frase, traducao, explicacao, audio_url').eq('id', fraseId).single();
      if (f1) { fraseData = f1; } else {
        const { data: f2 } = await supabase.from('frases_tematicos')
          .select('id, frase, traducao, explicacao, audio_url').eq('id', fraseId).single();
        fraseData = f2;
      }
      if (!fraseData) { setEstado('erro'); return; }

      // Verificar se já respondeu HOJE
      const hoje = new Date().toISOString().split('T')[0];
      const { data: controle } = await supabase
        .from('controle_envios')
        .select('id, estado, data_resposta')
        .eq('user_id', user.id)
        .eq('frase_id', fraseId)
        .not('sabe', 'is', null)
        .gte('data_resposta', `${hoje}T00:00:00`)
        .limit(1)
        .maybeSingle();

      if (controle) {
        setFrase({
          frase_id: fraseData.id, frase: fraseData.frase, traducao: fraseData.traducao,
          explicacao: fraseData.explicacao, audio_url: fraseData.audio_url, estado_atual: controle.estado,
        });
        setEstado('ja_respondeu');
        return;
      }

      // Buscar estado anterior
      const { data: controleAnterior } = await supabase
        .from('controle_envios')
        .select('estado')
        .eq('user_id', user.id)
        .eq('frase_id', fraseId)
        .not('sabe', 'is', null)
        .order('data_resposta', { ascending: false })
        .limit(1)
        .maybeSingle();

      setFrase({
        frase_id: fraseData.id, frase: fraseData.frase, traducao: fraseData.traducao,
        explicacao: fraseData.explicacao, audio_url: fraseData.audio_url,
        estado_atual: controleAnterior?.estado || null,
      });

      cardScale.value = withSpring(1, { damping: 12 });
      setEstado('pergunta');
    } catch (err) {
      console.error('Erro ao carregar frase:', err);
      setEstado('erro');
    }
  };

  // Responder via Edge Function
  const responder = async (sabe: boolean) => {
    if (!frase || !user?.id || processando) return;
    haptic(sabe ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
    setProcessando(true);
    setRespondeu(sabe);

    try {
      const response = await supabase.functions.invoke('responder-frase-app', {
        body: { user_id: user.id, frase_id: frase.frase_id, sabe },
      });

      if (response.data?.success) {
        setFeedbackData(response.data.feedback);
        setFraseInfo(response.data.frase_info);
      } else {
        setFeedbackData({ emoji: sabe ? '✅' : '📘', mensagem: sabe ? 'Você já conhece essa!' : 'Anotado para revisar!' });
        setFraseInfo({ traducao: frase.traducao, explicacao: frase.explicacao });
      }

      feedbackOpacity.value = withTiming(1, { duration: 300 });
      setEstado('feedback');
    } catch (err) {
      console.error('Erro ao processar resposta:', err);
      setFeedbackData({ emoji: sabe ? '✅' : '📘', mensagem: sabe ? 'Boa!' : 'Vamos praticar!' });
      setFraseInfo({ traducao: frase.traducao, explicacao: frase.explicacao });
      feedbackOpacity.value = withTiming(1, { duration: 300 });
      setEstado('feedback');
    } finally {
      setProcessando(false);
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
      } catch (err) { console.error('Erro áudio:', err); }
      setIsGeneratingAudio(false);
    }

    if (!audioUrl) return;
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      setIsPlaying(true);
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { setIsPlaying(false); sound.unloadAsync(); soundRef.current = null; }
      });
    } catch (err) { console.error('Erro play:', err); setIsPlaying(false); }
  };

  useEffect(() => { return () => { if (soundRef.current) soundRef.current.unloadAsync(); }; }, []);

  const fechar = () => { haptic(Haptics.ImpactFeedbackStyle.Light); router.canGoBack() ? router.back() : router.replace('/(tabs)/'); };
  const fecharApp = () => { haptic(Haptics.ImpactFeedbackStyle.Light); Platform.OS === 'android' ? BackHandler.exitApp() : fechar(); };
  const praticarMais = () => { haptic(); router.replace('/(tabs)/praticar'); };

  const getBadge = (est: string | null) => {
    if (!est || est === 'nova') return null;
    const map: Record<string, string> = {
      aprendendo: '🔄 Revisão', confirmacao: '✓ Confirmação',
      dominada: '🏆 Dominada', manutencao: '💎 Manutenção',
    };
    return map[est] || null;
  };

  // ═══ LOADING ═══
  if (estado === 'loading') {
    return <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  // ═══ ERRO ═══
  if (estado === 'erro') {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>😕</Text>
        <Text style={[styles.erroText, { color: colors.text1 }]}>Não foi possível carregar a frase</Text>
        <TouchableOpacity onPress={fechar} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
          <Text style={styles.btnPrimaryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══ JÁ RESPONDEU ═══
  if (estado === 'ja_respondeu') {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>✅</Text>
        <Text style={[styles.jaRespondeuTitle, { color: colors.green }]}>Você já respondeu essa!</Text>
        <View style={[styles.jaRespondeuCard, { backgroundColor: colors.bgCard }]}>
          <Text style={[styles.jaRespondeuFrase, { color: colors.text1 }]}>{frase?.frase}</Text>
          <Text style={[styles.jaRespondeuTraducao, { color: colors.text2 }]}>{frase?.traducao}</Text>
        </View>
        <TouchableOpacity onPress={praticarMais} style={[styles.btnPrimary, { backgroundColor: colors.accent, width: '100%' }]}>
          <Text style={styles.btnPrimaryText}>Praticar mais →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={fecharApp} style={[styles.btnSecondary, { borderColor: colors.border, width: '100%' }]}>
          <Text style={[styles.btnSecondaryText, { color: colors.text2 }]}>Fechar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ═══ FRASE ═══
  const badge = getBadge(frase?.estado_atual || null);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={fechar} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: colors.text2 }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerLabel, { color: colors.accent }]}>WordFlow</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.cardArea, cardAnimStyle]}>
          <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
            {badge && (
              <View style={[styles.badge, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>{badge}</Text>
              </View>
            )}

            <Text style={[styles.fraseText, { color: colors.text1 }]}>{frase?.frase}</Text>

            <TouchableOpacity
              onPress={playAudio} disabled={isGeneratingAudio}
              style={[styles.audioBtn, {
                backgroundColor: isPlaying ? colors.accent : colors.bgRaised,
                borderColor: isPlaying ? colors.accent : colors.border,
              }]}
            >
              {isGeneratingAudio
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <>
                    <Text style={{ fontSize: 18 }}>{isPlaying ? '⏸' : '🔊'}</Text>
                    <Text style={[styles.audioBtnText, { color: isPlaying ? '#fff' : colors.text2 }]}>
                      {isPlaying ? 'Pausar' : 'Ouvir pronúncia'}
                    </Text>
                  </>
              }
            </TouchableOpacity>

            {estado === 'feedback' && feedbackData && (
              <Animated.View style={[styles.feedbackArea, feedbackAnimStyle]}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={styles.feedbackEmoji}>{feedbackData.emoji}</Text>
                <Text style={[styles.feedbackMsg, { color: respondeu ? colors.green : colors.sky }]}>
                  {feedbackData.mensagem}
                </Text>
                {fraseInfo && (
                  <View style={[styles.traducaoBox, { backgroundColor: colors.bgRaised }]}>
                    <Text style={[styles.traducaoLabel, { color: colors.text3 }]}>TRADUÇÃO</Text>
                    <Text style={[styles.traducaoText, { color: colors.text1 }]}>{fraseInfo.traducao}</Text>
                    {fraseInfo.explicacao && (
                      <Text style={[styles.explicacaoText, { color: colors.text2 }]}>{fraseInfo.explicacao}</Text>
                    )}
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.bottomArea, { borderTopColor: colors.border }]}>
        {estado === 'pergunta' ? (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={() => responder(false)} disabled={processando}
              style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.rose, borderWidth: 2 }]}
            >
              {processando && respondeu === false ? <ActivityIndicator size="small" color={colors.rose} />
                : <><Text style={{ fontSize: 20 }}>🤔</Text><Text style={[styles.actionBtnText, { color: colors.rose }]}>Não sei</Text></>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => responder(true)} disabled={processando}
              style={[styles.actionBtn, { backgroundColor: colors.green }]}
            >
              {processando && respondeu === true ? <ActivityIndicator size="small" color="#fff" />
                : <><Text style={{ fontSize: 20 }}>✓</Text><Text style={[styles.actionBtnText, { color: '#fff' }]}>Sei</Text></>}
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.feedbackButtons}>
            <TouchableOpacity onPress={praticarMais} style={[styles.btnPrimary, { backgroundColor: colors.accent }]}>
              <Text style={styles.btnPrimaryText}>Praticar mais →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fecharApp} style={[styles.btnSecondary, { borderColor: colors.border }]}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8 },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 22, fontWeight: '300' },
  headerLabel: { fontSize: 16, fontWeight: '700' },
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  cardArea: { paddingHorizontal: 20 },
  card: { borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  badge: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  fraseText: { fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32 },
  audioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1 },
  audioBtnText: { fontSize: 14, fontWeight: '600' },
  feedbackArea: { width: '100%', alignItems: 'center', marginTop: 20 },
  divider: { height: 1, width: '100%', marginBottom: 20 },
  feedbackEmoji: { fontSize: 32, marginBottom: 8 },
  feedbackMsg: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  traducaoBox: { width: '100%', padding: 16, borderRadius: 14 },
  traducaoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  traducaoText: { fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24 },
  explicacaoText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  bottomArea: { paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, borderTopWidth: 1 },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  actionBtnText: { fontSize: 17, fontWeight: '700' },
  feedbackButtons: { gap: 10 },
  btnPrimary: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  btnPrimaryText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  btnSecondary: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  btnSecondaryText: { fontSize: 15, fontWeight: '600' },
  erroText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  jaRespondeuTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  jaRespondeuCard: { borderRadius: 16, padding: 20, marginBottom: 24, width: '100%' },
  jaRespondeuFrase: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  jaRespondeuTraducao: { fontSize: 14, textAlign: 'center' },
});