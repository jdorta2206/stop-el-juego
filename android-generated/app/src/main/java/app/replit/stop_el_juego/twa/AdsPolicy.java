package app.replit.stop_el_juego.twa;

/**
 * Single native advertising safety switch.
 *
 * Keep AdMob disabled until the account is explicitly reactivated and
 * a reviewed Google Play release is approved for ads.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = false;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
