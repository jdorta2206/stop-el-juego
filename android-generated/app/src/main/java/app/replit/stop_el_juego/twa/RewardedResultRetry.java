package app.replit.stop_el_juego.twa;

/**
 * Retry policy for delivering the non-authoritative client result of a rewarded ad.
 * This class deliberately has no Android dependencies so its policy can be JVM-tested.
 */
final class RewardedResultRetry {
    static final int MAX_ATTEMPTS = 3;

    interface Request {
        int execute(int attempt) throws Exception;
    }

    interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }

    private RewardedResultRetry() {}

    /**
     * Returns the last HTTP status, -1 after a transport exception, or -2 if interrupted.
     */
    static int deliver(Request request, Sleeper sleeper) {
        int lastStatus = -1;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                lastStatus = request.execute(attempt);
                if (lastStatus >= 200 && lastStatus < 300) return lastStatus;
                if (!isTransientStatus(lastStatus)) return lastStatus;
            } catch (Exception error) {
                lastStatus = -1;
            }

            if (attempt < MAX_ATTEMPTS) {
                try {
                    sleeper.sleep(500L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return -2;
                }
            }
        }
        return lastStatus;
    }

    static boolean isTransientStatus(int status) {
        return status >= 500 || status == 408 || status == 429;
    }
}
