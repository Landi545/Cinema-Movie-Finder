#pragma once

// Prosty interfejs C pozwala użyć tego samego silnika przez JNI i Objective-C++.
#ifdef __cplusplus
extern "C" {
#endif
unsigned long long cinema_generation(void);
char* cinema_request(const char* input, unsigned long long generation);
void cinema_cancel(void);
void cinema_free(char* value);
#ifdef __cplusplus
}
#endif
