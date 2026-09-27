import React, { useContext, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ContextAppLoaded } from '@app/context';
import { RouteEnum, ScreenEnum } from '@app/AppState';
import { AppDrawerParamList } from '@app/types';
import { useTheme } from '@app/theme';
import {
  getSwarmMark,
  getZingoName,
  getZingoVersion,
} from '@app/utils/ZingoAppData';
import { LEGAL_LINKS, LegalLinkIdEnum } from '@app/legal';
import Header from '@ui/widgets/Header';
import { LegalSheet } from '@ui/widgets/LegalSheet';
import { networkNoticeKey } from '@app/utils/networkProfiles';

type AboutProps = NativeStackScreenProps<AppDrawerParamList, RouteEnum.About>;

export default function About({ navigation }: AboutProps) {
  const { translate, server } = useContext(ContextAppLoaded);
  const { colors } = useTheme();
  const [page, setPage] = useState<LegalLinkIdEnum>();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bgCanvas }]}>
      <Header
        title={getZingoName()}
        screenName={ScreenEnum.About}
        noBalance
        noSyncingStatus
        noDrawMenu
        noPrivacy
        closeScreen={() => navigation.goBack()}
      />
      <ScrollView
        testID="about.scroll-view"
        contentContainerStyle={styles.content}
      >
        <Image source={getSwarmMark()} style={styles.mark} />
        <Text style={[styles.version, { color: colors.fgMuted }]}>
          {getZingoVersion()}
        </Text>
        <Text style={[styles.description, { color: colors.fgDefault }]}>
          {String(translate('welcome.description'))}
        </Text>
        <Text style={[styles.description, { color: colors.fgMuted }]}>
          {String(translate(networkNoticeKey(server.chainName)))}
        </Text>
        <View testID="about.legal" style={styles.links}>
          {LEGAL_LINKS.map(link => (
            <Pressable
              key={link.id}
              testID={`about.legal-${link.id}`}
              accessibilityRole="button"
              onPress={() => setPage(link.id)}
              style={[styles.link, { borderColor: colors.borderMuted }]}
            >
              <Text style={[styles.linkText, { color: colors.fgAccent }]}>
                {String(translate(link.labelKey))}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {page && (
        <LegalSheet
          page={page}
          chain={server.chainName}
          translate={translate}
          onClose={() => setPage(undefined)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  linkText: { fontSize: 17 },
  screen: { flex: 1 },
  content: { padding: 24, gap: 20 },
  mark: {
    width: 120,
    height: 56,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginTop: 16,
  },
  version: { textAlign: 'center', fontSize: 15 },
  description: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  links: { gap: 12 },
  link: { minHeight: 54, padding: 16, borderWidth: 1, borderRadius: 14 },
});
