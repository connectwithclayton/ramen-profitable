import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import {
  automationReviewerLine,
  codePanelStatus,
} from '../content/codePanel';
import type { CodePanelMode } from '../content/codePanel';
import { MonoText, Unit } from './ui';

type Props = {
  title: string;
  source: string;
  mode: CodePanelMode | 'paywall-clean' | 'paywall-questionable' | 'paywall-hostile';
  accessibilityLabel: string;
  automationRate?: number;
};

function presentation(mode: Props['mode'], automationRate?: number) {
  switch (mode) {
    case 'depleted':
      return { status: codePanelStatus(mode), tone: C.gold, sourceColor: C.ink };
    case 'automated':
      return {
        status: codePanelStatus(mode, automationRate),
        tone: C.mint,
        sourceColor: C.ink,
      };
    case 'complete':
      return { status: codePanelStatus(mode), tone: C.mint, sourceColor: C.ink };
    case 'paywall-clean':
      return { status: 'PAYWALL CODE · CLEAN', tone: C.mint, sourceColor: C.ink };
    case 'paywall-questionable':
      return { status: 'PAYWALL CODE · QUESTIONABLE', tone: C.gold, sourceColor: C.ink };
    case 'paywall-hostile':
      return { status: 'PAYWALL CODE · HOSTILE', tone: C.pink, sourceColor: C.ink };
    default:
      return { status: codePanelStatus(mode), tone: C.line, sourceColor: C.mut };
  }
}

/** A quiet derived view during manual work; its only motion comes from real automated LOC updates. */
export default function CodePanel({
  title,
  source,
  mode,
  accessibilityLabel,
  automationRate,
}: Props) {
  const look = presentation(mode, automationRate);
  const automated = mode === 'automated';

  return (
    <Unit
      testID="code-panel"
      tone={look.tone}
      style={mode !== 'manual' ? { ...st.panel, ...st.focused } : st.panel}
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={st.header} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MonoText style={[st.status, { color: look.tone }]}>{look.status}</MonoText>
          <MonoText numberOfLines={1} style={st.file}>{title}.swift</MonoText>
        </View>
        <View style={st.sourceArea} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {source ? (
            <MonoText style={[st.source, { color: look.sourceColor }]}>
              {source}
              {automated ? <Text style={st.caret}>▌</Text> : null}
            </MonoText>
          ) : (
            <MonoText style={st.empty}>NO SOURCE YET</MonoText>
          )}
        </View>
        {automated ? (
          <MonoText
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={st.reviewer}
          >
            {automationReviewerLine(automationRate ?? 0)}
          </MonoText>
        ) : null}
      </View>
    </Unit>
  );
}

const st = StyleSheet.create({
  panel: {
    padding: 12,
    backgroundColor: '#111625',
  },
  focused: {
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 9,
  },
  status: { fontSize: 9, letterSpacing: 1, fontWeight: '700', flexShrink: 0 },
  file: { color: C.dim, fontSize: 9, flexShrink: 1, textAlign: 'right' },
  sourceArea: { minHeight: 104 },
  source: { fontSize: 10.5, lineHeight: 17 },
  empty: { color: C.dim, fontSize: 10, letterSpacing: 1.1, paddingTop: 40, textAlign: 'center' },
  caret: { color: C.mint },
  reviewer: {
    color: C.mint,
    fontSize: 9.5,
    lineHeight: 15,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
});
