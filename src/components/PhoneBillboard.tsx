import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useGame } from '../state/gameStore';
import { adsModule, bannerId, consentRetryAvailable, mayRequestAds, prepareAds, privacyOptionsRequired, showAdPrivacyOptions } from '../monetization/ads';
import { Btn, MonoText, Section, SectionHeader, Unit } from './ui';
import { C, S } from '../theme';

const NON_PERSONALIZED_REQUEST = { requestNonPersonalizedAdsOnly: true } as const;
const RETRY_INTERVAL_MS = 60_000;
const CREATIVE_EXPIRY_MS = 60 * 60_000;
type CreativeState = 'idle' | 'pending' | 'loaded' | 'failed' | 'retrying';
export type BillboardViewportFrame = { y: number; height: number };
type BannerComponent = NonNullable<ReturnType<typeof adsModule>>['BannerAd'];
type RequestBoundBannerProps = Omit<React.ComponentProps<BannerComponent>, 'onPaid'> & {
  Banner: BannerComponent;
};

function RequestBoundBanner({
  Banner,
  onAdClosed,
  onAdFailedToLoad,
  onAdLoaded,
  onAdOpened,
  ...props
}: RequestBoundBannerProps) {
  const requestActiveRef = useRef(true);

  useLayoutEffect(() => {
    requestActiveRef.current = true;
    return () => { requestActiveRef.current = false; };
  }, []);

  // Known limitation: Fabric can recycle the native view; RN-GMA 16.5.0 removes the old banner
  // without clearing its delegate and forwards late callbacks through the current event emitter
  // without checking callback identity, bypassing this retired-closure guard.
  // Native-view release across replacement cycles remains unmeasured pending real-device verification.
  return (
    <Banner
      {...props}
      onAdClosed={onAdClosed ? () => {
        if (!requestActiveRef.current) return;
        onAdClosed();
      } : undefined}
      onAdFailedToLoad={onAdFailedToLoad ? error => {
        if (!requestActiveRef.current) return;
        onAdFailedToLoad(error);
      } : undefined}
      onAdLoaded={onAdLoaded ? dimensions => {
        if (!requestActiveRef.current) return;
        onAdLoaded(dimensions);
      } : undefined}
      onAdOpened={onAdOpened ? () => {
        if (!requestActiveRef.current) return;
        onAdOpened();
      } : undefined}
    />
  );
}

export default function PhoneBillboard({
  active = true,
  indie,
  onViewportFrameChange,
  viewportVisible,
}: {
  active?: boolean;
  indie: boolean;
  onViewportFrameChange: (frame: BillboardViewportFrame) => void;
  viewportVisible: boolean;
}) {
  const eligible = useGame(mayRequestAds);
  const overlay = useGame(s => s.overlay !== null);
  const notificationsClear = useGame(s => s.notifs.length === 0);
  const [ready, setReady] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [privacyStatusRevision, setPrivacyStatusRevision] = useState(0);
  const [width, setWidth] = useState(0);
  const [bannerWidth, setBannerWidth] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const widthRef = useRef(0);
  const lastRequestAtRef = useRef<number | null>(null);
  const lastLoadedAtRef = useRef<number | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [destinationOpen, setDestinationOpen] = useState(false);
  const wasBackgroundedRef = useRef(AppState.currentState === 'background');
  const [loadedForegroundReturnAt, setLoadedForegroundReturnAt] = useState<number | null>(null);
  const [loadedVisibilityReturnAt, setLoadedVisibilityReturnAt] = useState<number | null>(null);
  const [noFill, setNoFill] = useState(false);
  const [creativeState, setCreativeState] = useState<CreativeState>('idle');
  const creativeStateRef = useRef(creativeState);
  const [requestKey, setRequestKey] = useState(0);
  const sectionYRef = useRef<number | null>(null);
  const phoneYRef = useRef<number | null>(null);
  const billboardLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const surfaceActive = active && foreground && !overlay && !destinationOpen && notificationsClear;
  const retainedVisibilityActive = surfaceActive && viewportVisible;
  const measurementActive = retainedVisibilityActive && !privacyBusy;
  const requestable = measurementActive && layoutReady && eligible && width > 0;
  const nativeRequestInFlight = ready && (creativeState === 'pending' || creativeState === 'retrying');
  const wasRetainedVisibilityActiveRef = useRef(retainedVisibilityActive);
  const consentRetryAuthorizedRef = useRef(false);
  const expiredVisibilityReturnDue = (
    creativeState === 'loaded' &&
    loadedVisibilityReturnAt !== null &&
    lastLoadedAtRef.current !== null &&
    loadedVisibilityReturnAt - lastLoadedAtRef.current >= CREATIVE_EXPIRY_MS &&
    lastRequestAtRef.current !== null &&
    loadedVisibilityReturnAt - lastRequestAtRef.current >= RETRY_INTERVAL_MS
  );
  const wasRequestableRef = useRef(requestable);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') wasBackgroundedRef.current = true;
      if (state === 'active' && wasBackgroundedRef.current) {
        wasBackgroundedRef.current = false;
        setLoadedForegroundReturnAt(creativeStateRef.current === 'loaded' ? Date.now() : null);
      }
      setForeground(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useLayoutEffect(() => {
    creativeStateRef.current = creativeState;
  }, [creativeState]);

  const reportViewportFrame = useCallback(() => {
    const sectionY = sectionYRef.current;
    const phoneY = phoneYRef.current;
    const billboard = billboardLayoutRef.current;
    if (sectionY === null || phoneY === null || billboard === null) return;
    onViewportFrameChange({
      y: sectionY + phoneY + billboard.y,
      height: billboard.height,
    });
  }, [onViewportFrameChange]);

  const captureSectionLayout = useCallback((event: LayoutChangeEvent) => {
    sectionYRef.current = event.nativeEvent.layout.y;
    reportViewportFrame();
  }, [reportViewportFrame]);

  const capturePhoneLayout = useCallback((event: LayoutChangeEvent) => {
    phoneYRef.current = event.nativeEvent.layout.y;
    reportViewportFrame();
  }, [reportViewportFrame]);

  const captureBillboardLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, y } = event.nativeEvent.layout;
    billboardLayoutRef.current = { y, height };
    reportViewportFrame();
  }, [reportViewportFrame]);

  // Measured billboard-to-ScrollView intersection joins presentation state into one visibility signal;
  // route-by-route proxy enumeration was tried and kept missing cases.
  useLayoutEffect(() => {
    if (retainedVisibilityActive === wasRetainedVisibilityActiveRef.current) return;
    wasRetainedVisibilityActiveRef.current = retainedVisibilityActive;
    if (retainedVisibilityActive && eligible && consentRetryAvailable()) {
      consentRetryAuthorizedRef.current = true;
    }
    setLoadedVisibilityReturnAt(
      retainedVisibilityActive && creativeStateRef.current === 'loaded' ? Date.now() : null,
    );
  }, [eligible, retainedVisibilityActive]);

  useLayoutEffect(() => {
    if (!measurementActive) setLayoutReady(false);
  }, [measurementActive]);

  useEffect(() => {
    let cancelled = false;
    const needsPreparation = creativeState === 'idle' || creativeState === 'retrying';
    if (!ready && needsPreparation && (!noFill || creativeState === 'retrying') && requestable) {
      const retryRejectedConsent = consentRetryAuthorizedRef.current;
      consentRetryAuthorizedRef.current = false;
      const isRenderable = () => (
        !cancelled &&
        active &&
        viewportVisible &&
        widthRef.current > 0 &&
        AppState.currentState === 'active' &&
        useGame.getState().overlay === null &&
        useGame.getState().notifs.length === 0
      );
      const preparation = prepareAds(isRenderable, retryRejectedConsent);
      if (retryRejectedConsent) {
        setPrivacyStatusRevision(value => value + 1);
      }
      void preparation.then(allowed => {
        if (!cancelled) {
          setReady(allowed);
          if (allowed) {
            setBannerWidth(widthRef.current);
            if (creativeState === 'idle') setCreativeState('pending');
          } else {
            if (creativeState === 'retrying' && lastRequestAtRef.current !== null) {
              lastRequestAtRef.current = Date.now();
            }
            setCreativeState('failed');
          }
        }
      });
    }
    return () => { cancelled = true; };
  }, [active, creativeState, noFill, ready, requestable, revision, viewportVisible]);

  useEffect(() => {
    let cancelled = false;
    void privacyOptionsRequired().then(required => {
      if (!cancelled) setPrivacyRequired(required);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [privacyStatusRevision, revision]);

  useEffect(() => {
    setReady(false);
    setCreativeState(state => {
      if (state === 'failed') return state;
      return state === 'retrying' ? 'failed' : 'idle';
    });
  }, [eligible, privacyBusy, revision]);

  useEffect(() => {
    if (retainedVisibilityActive || !eligible || privacyBusy || !nativeRequestInFlight) return;
    setCreativeState('failed');
  }, [eligible, nativeRequestInFlight, privacyBusy, retainedVisibilityActive]);

  useEffect(() => {
    if (!requestable || nativeRequestInFlight) return;
    const requestAt = lastRequestAtRef.current;
    const reloadLoadedAfterForeground = (
      creativeState === 'loaded' &&
      loadedForegroundReturnAt !== null &&
      requestAt !== null &&
      loadedForegroundReturnAt - requestAt >= RETRY_INTERVAL_MS
    );
    if (loadedForegroundReturnAt !== null) setLoadedForegroundReturnAt(null);
    if (loadedVisibilityReturnAt !== null) setLoadedVisibilityReturnAt(null);
    if (width === bannerWidth && !reloadLoadedAfterForeground && !expiredVisibilityReturnDue) return;
    if (creativeState === 'loaded') {
      setCreativeState('pending');
      setRequestKey(value => value + 1);
    }
    setBannerWidth(width);
  }, [bannerWidth, creativeState, expiredVisibilityReturnDue, loadedForegroundReturnAt, loadedVisibilityReturnAt, nativeRequestInFlight, requestable, width]);

  // Any unloaded creative retries only on a qualifying return after any existing request cooldown.
  useEffect(() => {
    const returning = requestable && !wasRequestableRef.current;
    wasRequestableRef.current = requestable;
    const lastRequestAt = lastRequestAtRef.current;
    const retryDue = lastRequestAt === null
      ? creativeState === 'failed'
      : Date.now() - lastRequestAt >= RETRY_INTERVAL_MS;
    if (
      returning &&
      creativeState !== 'loaded' &&
      retryDue
    ) {
      if (lastRequestAt !== null) lastRequestAtRef.current = Date.now();
      setCreativeState('retrying');
      setRequestKey(value => value + 1);
      setBannerWidth(width);
    }
  }, [creativeState, requestable, width]);

  const mod = ready ? adsModule() : null;
  const id = bannerId();
  const Banner = mod?.BannerAd;
  const bannerActive = creativeState === 'loaded' || (
    requestable && (creativeState === 'pending' || creativeState === 'retrying')
  );
  const retryingWithFallback = noFill && creativeState === 'retrying';
  const show = eligible && !privacyBusy && ready && bannerActive && (!noFill || creativeState === 'retrying') && bannerWidth > 0 && Banner && id;
  const bannerMounted = Boolean(show);
  const geometryCurrent = layoutReady && width === bannerWidth;
  const bannerConcealed = retryingWithFallback || !geometryCurrent;
  const concealed = !retainedVisibilityActive || privacyBusy || expiredVisibilityReturnDue || (creativeState === 'loaded' && !geometryCurrent);

  const privacy = () => {
    setPrivacyBusy(true);
    setReady(false);
  };

  useEffect(() => {
    if (!privacyBusy || bannerMounted) return;
    let stale = false;
    void showAdPrivacyOptions()
      .catch(() => {
        if (!stale) {
          useGame.getState().pushNotif('Ad privacy choices are unavailable. Try again later.', 'store');
        }
      })
      .finally(() => {
        if (stale) return;
        setPrivacyBusy(false);
        setRevision(value => value + 1);
      });
    return () => { stale = true; };
  }, [bannerMounted, privacyBusy]);

  useEffect(() => {
    if (bannerMounted) lastRequestAtRef.current = Date.now();
  }, [bannerMounted, bannerWidth, requestKey, revision]);

  return (
    <Section onLayout={captureSectionLayout} style={st.section} testID="catvertising-section">
      <SectionHeader title="Your phone" meta="CATVERTISING" />
      <Unit onLayout={capturePhoneLayout} style={st.phone} testID="catvertising-phone">
        <View style={st.speaker} />
        <MonoText style={st.label}>BILLBOARD · ADVERTISEMENT</MonoText>
        <View
          onLayout={captureBillboardLayout}
          style={st.billboard}
          testID="catvertising-billboard-frame"
        >
          {measurementActive && (
            <View
              collapsable={false}
              pointerEvents="none"
              style={st.measurement}
              onLayout={event => {
                const nextWidth = event.nativeEvent.layout.width;
                if (nextWidth <= 0) return;
                widthRef.current = nextWidth;
                setWidth(nextWidth);
                setLayoutReady(true);
              }}
            />
          )}
          <View
            accessibilityElementsHidden={concealed}
            importantForAccessibility={concealed ? 'no-hide-descendants' : 'auto'}
            pointerEvents={concealed ? 'none' : 'auto'}
            style={[st.billboardContent, concealed && st.concealed]}
          >
            {show && (
              <View
                accessibilityElementsHidden={bannerConcealed}
                importantForAccessibility={bannerConcealed ? 'no-hide-descendants' : 'auto'}
                pointerEvents={bannerConcealed ? 'none' : 'auto'}
                style={bannerConcealed && st.pendingBanner}
              >
                <RequestBoundBanner
                  Banner={Banner}
                  key={`${revision}:${requestKey}`}
                  unitId={id}
                  size={mod.BannerAdSize.INLINE_ADAPTIVE_BANNER}
                  width={bannerWidth}
                  maxHeight={50}
                  requestOptions={NON_PERSONALIZED_REQUEST}
                  onAdOpened={() => setDestinationOpen(true)}
                  onAdClosed={() => setDestinationOpen(false)}
                  onAdLoaded={() => {
                    const loadedAt = Date.now();
                    lastLoadedAtRef.current = loadedAt;
                    lastRequestAtRef.current = loadedAt;
                    const latestWidth = widthRef.current;
                    if (requestable && latestWidth > 0 && latestWidth !== bannerWidth) {
                      setCreativeState(state => state === 'loaded' ? 'pending' : state);
                      setRequestKey(value => value + 1);
                      setBannerWidth(latestWidth);
                      return;
                    }
                    setNoFill(false);
                    setCreativeState('loaded');
                  }}
                  onAdFailedToLoad={error => {
                    if (__DEV__) console.warn('[Catvertising] Banner unavailable.', error);
                    const failedNoFill = (error as Error & { code?: string }).code === 'googleMobileAds/no-fill';
                    lastRequestAtRef.current = Date.now();
                    const failedState = creativeStateRef.current;
                    if (failedState !== 'pending' && failedState !== 'retrying') return;
                    if (failedNoFill) setNoFill(true);
                    setCreativeState('failed');
                  }}
                />
              </View>
            )}
            {indie ? (
              <Text style={st.empty}>Go Indie. No ads. Just you and the cat.</Text>
            ) : noFill ? (
              <Text style={st.empty}>The cat is between sponsors.</Text>
            ) : null}
          </View>
        </View>
        <Text style={st.caption}>Even your fictional phone has a business model.</Text>
        <View style={st.homeIndicator} />
      </Unit>
      {privacyRequired && <Btn small ghost label="Ad privacy choices" accessibilityLabel="Ad privacy choices" disabled={privacyBusy} onPress={privacy} style={st.privacy} />}
    </Section>
  );
}

const st = StyleSheet.create({
  section: { paddingHorizontal: S.gap },
  phone: { padding: 7, marginTop: S.gap, alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 24 },
  speaker: { width: 42, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginVertical: S.gap },
  label: { color: C.mut, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginVertical: S.gap },
  billboard: { minHeight: 50, backgroundColor: C.midnight },
  measurement: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  billboardContent: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center' },
  concealed: { display: 'none' },
  pendingBanner: { position: 'absolute', left: 0, right: 0, alignItems: 'center', opacity: 0 },
  empty: { color: C.mut, fontSize: 12, textAlign: 'center', padding: S.gap },
  caption: { color: C.mut, fontSize: 12, textAlign: 'center', marginHorizontal: S.gap, marginTop: S.row, lineHeight: 18 },
  homeIndicator: { width: 70, height: 3, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginTop: S.row, marginBottom: S.gap },
  privacy: { marginTop: S.row, alignSelf: 'center' },
});
