package app.replit.stop_el_juego.twa;

/**
 * Single native advertising safety switch.
 *
 * AdMob account is active again. Ads remain gated behind this switch so
 * they can be restored in a reviewed Google Play release.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = true;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
