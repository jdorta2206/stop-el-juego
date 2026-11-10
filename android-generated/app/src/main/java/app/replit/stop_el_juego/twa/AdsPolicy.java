package app.replit.stop_el_juego.twa;

/**
 * Single native advertising safety switch.
 *
 * AdMob remains disabled until it is explicitly reactivated and reviewed.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = false;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
