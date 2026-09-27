import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { useTheme } from '@app/theme';
import {
  LegalLinkIdEnum,
  riskNoticeParagraphs,
  RISK_NOTICE_TITLE,
} from '@app/legal';
import { legalDocument } from '@app/legal/legalDocuments';
import { TranslateType } from '@app/AppState';

type LegalSheetProps = {
  page: LegalLinkIdEnum;
  /**
   * The chain label whose wording these documents describe. Optional for the
   * same reason as the notice's: a screen may open before the chain is known.
   */
  chain?: string;
  translate: (key: string) => TranslateType;
  onClose: () => void;
};

export function LegalSheet({
  page,
  chain,
  translate,
  onClose,
}: LegalSheetProps) {
  const { colors } = useTheme();
  const notices = translate('about.copyright');
  const document =
    page === LegalLinkIdEnum.privacy || page === LegalLinkIdEnum.terms
      ? legalDocument(page, chain)
      : page === LegalLinkIdEnum.risks
        ? { title: RISK_NOTICE_TITLE, paragraphs: riskNoticeParagraphs(chain) }
        : {
            title: String(translate('about.open-source-notices')),
            paragraphs: Array.isArray(notices) ? notices : [],
          };
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView
          style={[styles.screen, { backgroundColor: colors.bgCanvas }]}
        >
          <View style={styles.header}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.fgDefault }]}
            >
              {document.title}
            </Text>
            <Pressable
              testID="legal.close"
              onPress={onClose}
              accessibilityRole="button"
              style={styles.close}
            >
              <Text style={{ color: colors.fgAccent }}>
                {String(translate('close'))}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            testID={`legal.${page}`}
            contentContainerStyle={styles.content}
          >
            {document.paragraphs.map((paragraph, index) => (
              <Text
                key={index}
                selectable
                style={[styles.paragraph, { color: colors.fgDefault }]}
              >
                {String(paragraph).replaceAll('**', '')}
              </Text>
            ))}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  title: { flex: 1, fontSize: 21, fontWeight: '600' },
  close: { minHeight: 44, justifyContent: 'center', padding: 8 },
  content: { padding: 24 },
  paragraph: { fontSize: 16, lineHeight: 25, marginBottom: 24 },
});
