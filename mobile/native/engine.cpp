#include <atomic>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include "../plugin/ios/engine.h"
#include "certificates.h"

static std::atomic<unsigned long long> generation{0};
static unsigned long long activeGeneration = 0;
static std::chrono::steady_clock::time_point deadline;
static bool interrupted() {
    return activeGeneration != generation.load() || std::chrono::steady_clock::now() >= deadline;
}
#define CINEMA_MOBILE
#include "../../main.cpp"

extern "C" unsigned long long cinema_generation() { return generation.load(); }
extern "C" void cinema_cancel() { ++generation; }
extern "C" void cinema_free(char* value) { std::free(value); }
extern "C" char* cinema_request(const char* input, unsigned long long token) {
    static std::mutex mutex;
    std::lock_guard<std::mutex> lock(mutex);
    static const bool initialized = [] {
        if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return false;
        xmlInitParser();
        sharedCookieStore = curl_share_init();
        if (sharedCookieStore) curl_share_setopt(sharedCookieStore, CURLSHOPT_SHARE, CURL_LOCK_DATA_COOKIE);
        return true;
    }();
    static SearchResults results;
    activeGeneration = token;
    deadline = std::chrono::steady_clock::now() + std::chrono::minutes(3);
    Json response(nullptr, json_object_put);
    try {
        if (!initialized) throw std::runtime_error("Nie udało się uruchomić połączenia.");
        if (interrupted()) throw std::runtime_error("Anulowano pobieranie.");
        Json request(json_tokener_parse(input), json_object_put);
        if (!request || !json_object_is_type(request.get(), json_type_object))
            throw std::runtime_error("Niepoprawne żądanie.");
        response = desktopRequest(request.get(), results);
        if (interrupted()) throw std::runtime_error("Pobieranie przerwano lub przekroczono limit czasu.");
    } catch (const std::exception& error) {
        results = {};
        response.reset(json_object_new_object());
        addText(response.get(), "error", error.what());
    }
    return strdup(json_object_to_json_string_ext(response.get(), JSON_C_TO_STRING_PLAIN));
}

#ifdef __ANDROID__
#include <jni.h>
extern "C" JNIEXPORT jlong JNICALL Java_pl_landi_cinema_CinemaEnginePlugin_generation(JNIEnv*, jobject) {
    return static_cast<jlong>(cinema_generation());
}
extern "C" JNIEXPORT void JNICALL Java_pl_landi_cinema_CinemaEnginePlugin_stop(JNIEnv*, jobject) { cinema_cancel(); }
extern "C" JNIEXPORT jbyteArray JNICALL Java_pl_landi_cinema_CinemaEnginePlugin_run(JNIEnv* env, jobject, jbyteArray input, jlong token) {
    std::string text(static_cast<size_t>(env->GetArrayLength(input)), '\0');
    env->GetByteArrayRegion(input, 0, static_cast<jsize>(text.size()), reinterpret_cast<jbyte*>(text.data()));
    char* response = cinema_request(text.c_str(), static_cast<unsigned long long>(token));
    const auto length = static_cast<jsize>(std::strlen(response));
    auto output = env->NewByteArray(length);
    if (output) env->SetByteArrayRegion(output, 0, length, reinterpret_cast<jbyte*>(response));
    cinema_free(response);
    return output;
}
#endif
