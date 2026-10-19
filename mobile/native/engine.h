#pragma once

// Wspólny interfejs C silnika używany przez natywny most Androida i testy.
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
