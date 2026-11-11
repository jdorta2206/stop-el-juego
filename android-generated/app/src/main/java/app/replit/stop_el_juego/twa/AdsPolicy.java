package app.replit.stop_el_juego.twa;

/**
 * Single native advertising policy switch. AdMob serving has been reactivated.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = true;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
