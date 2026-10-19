package pl.landi.cinema;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "CinemaEngine")
public class CinemaEnginePlugin extends Plugin {
    static { System.loadLibrary("cinema"); }
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private native byte[] run(byte[] input, long generation);
    private native long generation();
    private native void stop();

    @PluginMethod
    public void request(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("Niepoprawne żądanie."); return; }
        long token = generation();
        // Sieć i parsery pracują poza wątkiem interfejsu; UTF-8 zachowuje też emoji w tytułach.
        worker.execute(() -> {
            try {
                String response = new String(run(json.getBytes(StandardCharsets.UTF_8), token), StandardCharsets.UTF_8);
                call.resolve(new JSObject().put("json", response));
            } catch (Exception error) { call.reject("Nie udało się pobrać repertuaru.", error); }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) { stop(); call.resolve(); }

    @Override
    protected void handleOnDestroy() { stop(); worker.shutdownNow(); }
}
