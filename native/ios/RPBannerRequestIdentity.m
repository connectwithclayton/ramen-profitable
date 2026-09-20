#import <Foundation/Foundation.h>
#import <objc/runtime.h>

// RNGoogleMobileAdsBannerView receives the GADBannerView that produced every
// delegate callback, but RN-GMA 16.5.0 sends through the component view's
// current Fabric event emitter without comparing that banner to self.banner.
// A recycled component view can therefore deliver request A through request B.
// Keep the boundary in the app while the dependency remains pinned.

static IMP RPBannerDidLoad;
static IMP RPBannerDidFail;
static IMP RPBannerDidOpen;
static IMP RPBannerDidRecordImpression;
static IMP RPBannerDidRecordClick;
static IMP RPBannerDidClose;
static IMP RPBannerDidReceiveAppEvent;

static BOOL RPBannerOwnsCallback(id componentView, id callbackBanner) {
  Method getter = class_getInstanceMethod([componentView class], sel_registerName("banner"));
  if (getter == NULL || callbackBanner == nil) {
    return NO;
  }

  id (*currentBanner)(id, SEL) = (id (*)(id, SEL))method_getImplementation(getter);
  return currentBanner(componentView, sel_registerName("banner")) == callbackBanner;
}

static void RPBannerViewDidReceiveAd(id self, SEL command, id bannerView) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id))RPBannerDidLoad)(self, command, bannerView);
  }
}

static void RPBannerViewDidFail(id self, SEL command, id bannerView, id error) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id, id))RPBannerDidFail)(self, command, bannerView, error);
  }
}

static void RPBannerViewDidOpen(id self, SEL command, id bannerView) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id))RPBannerDidOpen)(self, command, bannerView);
  }
}

static void RPBannerViewDidRecordImpression(id self, SEL command, id bannerView) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id))RPBannerDidRecordImpression)(self, command, bannerView);
  }
}

static void RPBannerViewDidRecordClick(id self, SEL command, id bannerView) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id))RPBannerDidRecordClick)(self, command, bannerView);
  }
}

static void RPBannerViewDidClose(id self, SEL command, id bannerView) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id))RPBannerDidClose)(self, command, bannerView);
  }
}

static void RPBannerViewDidReceiveAppEvent(
    id self,
    SEL command,
    id bannerView,
    id name,
    id info) {
  if (RPBannerOwnsCallback(self, bannerView)) {
    ((void (*)(id, SEL, id, id, id))RPBannerDidReceiveAppEvent)(
        self, command, bannerView, name, info);
  }
}

static BOOL RPReplaceCallback(
    Class componentClass,
    const char *selectorName,
    IMP replacement,
    IMP *original) {
  Method method = class_getInstanceMethod(componentClass, sel_registerName(selectorName));
  if (method == NULL) {
    NSLog(@"[Catvertising] Missing RN-GMA callback selector %s; request identity guard was not installed.", selectorName);
    return NO;
  }
  *original = method_setImplementation(method, replacement);
  return *original != NULL;
}

void RPInstallBannerRequestIdentityGuard(void) {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class componentClass = NSClassFromString(@"RNGoogleMobileAdsBannerView");
    if (componentClass == Nil) {
      return;
    }

    BOOL installed = YES;
    installed &= RPReplaceCallback(
        componentClass,
        "bannerViewDidReceiveAd:",
        (IMP)RPBannerViewDidReceiveAd,
        &RPBannerDidLoad);
    installed &= RPReplaceCallback(
        componentClass,
        "bannerView:didFailToReceiveAdWithError:",
        (IMP)RPBannerViewDidFail,
        &RPBannerDidFail);
    installed &= RPReplaceCallback(
        componentClass,
        "bannerViewWillPresentScreen:",
        (IMP)RPBannerViewDidOpen,
        &RPBannerDidOpen);
    installed &= RPReplaceCallback(
        componentClass,
        "bannerViewDidRecordImpression:",
        (IMP)RPBannerViewDidRecordImpression,
        &RPBannerDidRecordImpression);
    installed &= RPReplaceCallback(
        componentClass,
        "bannerViewDidRecordClick:",
        (IMP)RPBannerViewDidRecordClick,
        &RPBannerDidRecordClick);
    installed &= RPReplaceCallback(
        componentClass,
        "bannerViewDidDismissScreen:",
        (IMP)RPBannerViewDidClose,
        &RPBannerDidClose);
    installed &= RPReplaceCallback(
        componentClass,
        "adView:didReceiveAppEvent:withInfo:",
        (IMP)RPBannerViewDidReceiveAppEvent,
        &RPBannerDidReceiveAppEvent);

    if (!installed) {
      NSLog(@"[Catvertising] RN-GMA request identity guard is incomplete.");
    }
  });
}

__attribute__((constructor)) static void RPInstallBannerRequestIdentityGuardAtLaunch(void) {
  RPInstallBannerRequestIdentityGuard();
}
