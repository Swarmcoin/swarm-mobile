/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '@app/theme';
import Button, { ButtonTypeEnum } from '@ui/primitives/Button';
import BoldText from '@ui/primitives/BoldText';
import {
  RISK_NOTICE_ACKNOWLEDGE,
  riskNoticeParagraphs,
  RISK_NOTICE_TITLE,
} from '@app/legal';

type RiskNoticeProps = {
  /**
   * `gate` is the one-time screen before the first wallet exists: one button,
   * "I understand", and no way past it. `read` is the same text reached again
   * from Settings → About, where the button only closes it.
   */
  mode: 'gate' | 'read';
  /** The chain label whose notice this renders. */
  chain: string;
  /** Label for the `read` button. The gate's label is the notice's own. */
  closeLabel?: string;
  onDismiss: () => void;
};

// Renders one paragraph, bolding the `**…**` lead-in. Same convention the
// migration screens use, kept local so this component depends on nothing that
// might be restyled for a different screen.
const NoticeParagraph: React.FunctionComponent<{
  text: string;
  color: string;
  highlight: string;
}> = ({ text, color, highlight }) => (
  <Text
    style={{ color, fontSize: 15, lineHeight: 23, marginBottom: 18 }}
    accessible={true}
  >
    {text.split(/(\*\*[^*]+\*\*)/g).map((part: string, i: number) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <Text key={i} style={{ color: highlight, fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      ),
    )}
  </Text>
);

/**
 * The "Before you start" risk notice.
 *
 * The text is the legal source string in `app/legal/riskNotice.ts`, one per
 * network and the same text as the published page. It is not translated and
 * not edited here. See that file for why.
 */
const RiskNotice: React.FunctionComponent<RiskNoticeProps> = ({
  mode,
  chain,
  closeLabel,
  onDismiss,
}) => {
  const { colors } = useTheme();
  const paragraphs = riskNoticeParagraphs(chain);

  return (
    <SafeAreaView
      testID="risknotice.screen"
      style={{
        // Absolute and opaque: as a gate this covers whatever the boot
        // sequence was drawing, and nothing behind it is reachable.
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        backgroundColor: colors.bgCanvas,
      }}
    >
      <View style={{ flex: 1 }}>
        <BoldText
          testID="risknotice.title"
          style={{
            fontSize: 22,
            textAlign: 'center',
            marginTop: 24,
            marginBottom: 20,
          }}
        >
          {RISK_NOTICE_TITLE}
        </BoldText>
        <ScrollView
          testID="risknotice.scroll-view"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12 }}
        >
          {paragraphs.map((text: string) => (
            <NoticeParagraph
              key={text.substring(0, 24)}
              text={text}
              color={colors.fgMuted}
              highlight={colors.fgDefault}
            />
          ))}
        </ScrollView>
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 18,
            borderTopWidth: 1,
            borderTopColor: colors.borderMuted,
          }}
        >
          <Button
            testID="risknotice.acknowledge"
            type={ButtonTypeEnum.Primary}
            title={
              mode === 'gate' ? RISK_NOTICE_ACKNOWLEDGE : (closeLabel ?? '')
            }
            onPress={onDismiss}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RiskNotice;
