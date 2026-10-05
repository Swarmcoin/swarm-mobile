// The semantic token layer. 24 roles, flat camelCase, per-surface.
//
// These are the SWARM design system's colours. The role names are upstream's
// and are deliberately unchanged: about a hundred files read them through
// `useTheme()`, and renaming the roles would have been a rename, not a
// repaint.
//
// The palette, by its own names:
//
//   Void       #0A0908  app background
//   Base       #100E0C  panel / container background
//   Surface 1  #171411  card, input, tile, chip background
//   Surface 2  #1F1B17  nested surface
//   Wax        #F5EFE4  primary text
//   Text Mid   #A89F92  body / secondary text
//   Text Low   #7D746A  captions, disabled glyphs
//
//   Hive Orange #FF8A1F  brand, primary action, SHIELDED state, value
//   Honey       #FFB020  highlights, rewards, secondary emphasis, warning
//   Honey Light #FFD08A  foreground on shielded surfaces
//   Clear Blue  #6FB6FF  RESERVED: privacy OFF / transparent only
//   Success     #3DD68C
//   Danger      #FF5C5C
//
// Clear Blue is not in this file on purpose. It is not a general accent: the
// design system reserves it for the transparent / "privacy off" state, where
// it must appear together with the warning copy that says what is public.
// Reaching for it as a second accent would make a revealed transaction look
// ordinary, which is the one thing it must never look like.
//
// There is no light mode. Both token sets below are dark; `mode` picks
// feature complexity (basic / advanced), not brightness.

export type ThemeColors = {
  bgCanvas: string;
  bgSurface: string;
  bgChrome: string;
  bottomSheetBorder: string;

  fgDefault: string;

  fgMuted: string;
  borderMuted: string;
  bgMuted: string;

  fgAccent: string;
  borderAccent: string;
  bgAccent: string;

  fgAccentDisabled: string;
  borderAccentDisabled: string;
  bgAccentDisabled: string;
  bgSecondaryDisabled: string;

  fgSyncing: string;
  borderSyncing: string;

  fgWarning: string;
  fgWarningEmphasis: string;
  fgWarningDark: string;
  borderWarning: string;
  bgWarning: string;

  fgDanger: string;
  fgDangerEmphasis: string;
};

/**
 * Clear Blue. Not a theme role: it belongs to the transparent / privacy-off
 * state, which is a meaning rather than a surface. Import it only where the
 * surrounding copy says the transaction is public.
 */
export const REVEALED_ACCENT = '#6FB6FF';

/** Foreground on a Clear Blue surface. Text is never #6FB6FF itself. */
export const REVEALED_FOREGROUND = '#BFDDFF';

/** Foreground on a shielded (Hive Orange) surface. */
export const SHIELDED_FOREGROUND = '#FFD08A';

/** Text and icons on a filled Hive Orange surface. */
export const ON_ACCENT = '#1A0F02';

/** Nested surface, one step above a card. */
export const BG_SURFACE_NESTED = '#1F1B17';

/** Success green, used for a price that rose over the period shown. */
export const PRICE_UP = '#3DD68C';

const base = {
  bgCanvas: '#0A0908',
  bgSurface: '#171411',
  bgChrome: '#100E0C',
  bottomSheetBorder: '#2A251F',
  fgDefault: '#F5EFE4',

  // Syncing is honey: work in progress, not an error and not success.
  fgSyncing: '#FFB020',
  borderSyncing: '#FFB020',

  fgWarning: '#FFB020',
  fgWarningEmphasis: '#FFD08A',
  fgWarningDark: '#C97F10',
  borderWarning: '#65491C',
  bgWarning: '#1F1B17',

  fgDanger: '#FF5C5C',
  fgDangerEmphasis: '#FF5C5C',
} as const;

export const advancedTokens: ThemeColors = {
  ...base,
  fgAccent: '#FF8A1F',
  borderAccent: '#FF8A1F',
  bgAccent: '#FF8A1F',
  fgAccentDisabled: '#7A4310',
  borderAccentDisabled: '#7A4310',
  bgAccentDisabled: '#7A4310',
  bgSecondaryDisabled: '#2A1C0C',
  fgMuted: '#A89F92',
  borderMuted: '#3A342C',
  bgMuted: '#7D746A',
};

export const basicTokens: ThemeColors = {
  ...base,
  fgAccent: '#FF8A1F',
  borderAccent: '#FF8A1F',
  bgAccent: '#FF8A1F',
  fgAccentDisabled: '#7A4310',
  borderAccentDisabled: '#7A4310',
  bgAccentDisabled: '#7A4310',
  bgSecondaryDisabled: '#2A1C0C',
  fgMuted: '#A89F92',
  borderMuted: '#3A342C',
  bgMuted: '#7D746A',
};
