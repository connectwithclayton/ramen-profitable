#import <Foundation/Foundation.h>

@interface RPTestBanner : NSObject
@end
@implementation RPTestBanner
@end

@interface RNGoogleMobileAdsBannerView : NSObject
@property(nonatomic, strong) RPTestBanner *banner;
@property(nonatomic) NSUInteger deliveredCallbacks;
- (void)bannerViewDidReceiveAd:(RPTestBanner *)bannerView;
- (void)bannerView:(RPTestBanner *)bannerView didFailToReceiveAdWithError:(NSError *)error;
- (void)bannerViewWillPresentScreen:(RPTestBanner *)bannerView;
- (void)bannerViewDidRecordImpression:(RPTestBanner *)bannerView;
- (void)bannerViewDidRecordClick:(RPTestBanner *)bannerView;
- (void)bannerViewDidDismissScreen:(RPTestBanner *)bannerView;
- (void)adView:(RPTestBanner *)bannerView didReceiveAppEvent:(NSString *)name withInfo:(NSString *)info;
@end

@implementation RNGoogleMobileAdsBannerView
- (void)bannerViewDidReceiveAd:(RPTestBanner *)bannerView { self.deliveredCallbacks++; }
- (void)bannerView:(RPTestBanner *)bannerView didFailToReceiveAdWithError:(NSError *)error { self.deliveredCallbacks++; }
- (void)bannerViewWillPresentScreen:(RPTestBanner *)bannerView { self.deliveredCallbacks++; }
- (void)bannerViewDidRecordImpression:(RPTestBanner *)bannerView { self.deliveredCallbacks++; }
- (void)bannerViewDidRecordClick:(RPTestBanner *)bannerView { self.deliveredCallbacks++; }
- (void)bannerViewDidDismissScreen:(RPTestBanner *)bannerView { self.deliveredCallbacks++; }
- (void)adView:(RPTestBanner *)bannerView didReceiveAppEvent:(NSString *)name withInfo:(NSString *)info { self.deliveredCallbacks++; }
@end

static void deliverAllCallbacks(RNGoogleMobileAdsBannerView *view, RPTestBanner *banner) {
  [view bannerViewDidReceiveAd:banner];
  [view bannerView:banner didFailToReceiveAdWithError:[NSError errorWithDomain:@"test" code:1 userInfo:nil]];
  [view bannerViewWillPresentScreen:banner];
  [view bannerViewDidRecordImpression:banner];
  [view bannerViewDidRecordClick:banner];
  [view bannerViewDidDismissScreen:banner];
  [view adView:banner didReceiveAppEvent:@"event" withInfo:@"info"];
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    BOOL guarded = argc == 2 && strcmp(argv[1], "guarded") == 0;
    RNGoogleMobileAdsBannerView *componentView = [RNGoogleMobileAdsBannerView new];
    RPTestBanner *requestA = [RPTestBanner new];
    RPTestBanner *requestB = [RPTestBanner new];

    componentView.banner = requestA;
    componentView.banner = requestB; // Fabric recycles the component view for request B.
    deliverAllCallbacks(componentView, requestA); // Request A settles after replacement.

    if (guarded) {
      if (componentView.deliveredCallbacks != 0) return 10;
      deliverAllCallbacks(componentView, requestB);
      if (componentView.deliveredCallbacks != 7) return 11;
      componentView.banner = nil; // prepareForRecycle has retired request B.
      deliverAllCallbacks(componentView, requestB);
      if (componentView.deliveredCallbacks != 7) return 12;
      puts("guarded: delayed and retired callbacks rejected; current callbacks delivered");
      return 0;
    }

    if (componentView.deliveredCallbacks != 7) return 20;
    puts("reproduced: request A callbacks reached request B's current component view");
    return 0;
  }
}
