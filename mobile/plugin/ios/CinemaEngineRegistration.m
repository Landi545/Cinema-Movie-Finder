#import <Capacitor/Capacitor.h>

CAP_PLUGIN(CinemaEnginePlugin, "CinemaEngine",
    CAP_PLUGIN_METHOD(request, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(cancel, CAPPluginReturnPromise);
)
