package app.replit.stop_el_juego.twa;

/**
 * Single native advertising safety switch.
 *
 * Keep false while the AdMob account is suspended or while production
 * traffic has not been cleared for monetization. Re-enable only in a
 * reviewed release after the suspension period and policy checks.
 */
public final class AdsPolicy {
    private static final boolean ENABLED = false;

    private AdsPolicy() {}

    public static boolean isEnabled() {
        return ENABLED;
    }
}
