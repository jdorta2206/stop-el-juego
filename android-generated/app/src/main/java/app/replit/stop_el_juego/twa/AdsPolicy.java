package app.replit.stop_el_juego.twa;

/**
 * Single native advertising safety switch.
 *
 * AdMob remains temporarily disabled pending account reactivation.
 * Keep the integration and ad units intact so ads can be restored later.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = false;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
