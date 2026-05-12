#import <LocalAuthentication/LocalAuthentication.h>
#import <Foundation/Foundation.h>

int velo_check_biometric_available(void) {
    LAContext *ctx = [[LAContext alloc] init];
    NSError *err = nil;
    return [ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&err] ? 1 : 0;
}

int velo_authenticate_biometric(const char *reason) {
    LAContext *ctx = [[LAContext alloc] init];
    NSString *rs = [NSString stringWithUTF8String:reason ?: "Войти в приложение"];
    __block int result = 0;
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    [ctx evaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics
        localizedReason:rs
                  reply:^(BOOL success, NSError * __unused e) {
        result = success ? 1 : 0;
        dispatch_semaphore_signal(sem);
    }];
    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
    return result;
}
