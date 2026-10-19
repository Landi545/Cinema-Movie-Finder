#import <Capacitor/Capacitor.h>
#import <Capacitor/CAPBridgedJSTypes.h>
#include "engine.h"

@interface CinemaEnginePlugin : CAPPlugin
@property(nonatomic, strong) dispatch_queue_t worker;
@end

@implementation CinemaEnginePlugin
- (void)load {
    self.worker = dispatch_queue_create("pl.landi.cinema.engine", DISPATCH_QUEUE_SERIAL);
}
- (void)request:(CAPPluginCall *)call {
    NSString *input = [call getString:@"json" defaultValue:nil];
    if (!input) { [call resolve:@{@"json": @"{\"error\":\"Niepoprawne żądanie.\"}"}]; return; }
    unsigned long long token = cinema_generation();
    // Kolejka szeregowa chroni wyniki sesji, nie blokując gestów ani animacji.
    dispatch_async(self.worker, ^{
        char *json = cinema_request(input.UTF8String, token);
        NSString *response = [NSString stringWithUTF8String:json];
        cinema_free(json);
        [call resolve:@{@"json": response}];
    });
}
- (void)cancel:(CAPPluginCall *)call { cinema_cancel(); [call resolve]; }
- (void)dealloc { cinema_cancel(); }
@end
