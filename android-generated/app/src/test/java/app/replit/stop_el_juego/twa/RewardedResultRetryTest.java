package app.replit.stop_el_juego.twa;

import org.junit.Test;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class RewardedResultRetryTest {
    @Test
    public void succeedsOnFirstAttemptWithoutWaiting() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> { calls.incrementAndGet(); return 204; },
                delays::add);

        assertEquals(204, result);
        assertEquals(1, calls.get());
        assertTrue(delays.isEmpty());
    }

    @Test
    public void retriesServerErrorThenSucceeds() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> calls.incrementAndGet() == 1 ? 503 : 204,
                delays::add);

        assertEquals(204, result);
        assertEquals(2, calls.get());
        assertEquals(Arrays.asList(500L), delays);
    }

    @Test
    public void retriesRateLimitAndRequestTimeout() {
        assertTrue(RewardedResultRetry.isTransientStatus(429));
        assertTrue(RewardedResultRetry.isTransientStatus(408));
        assertTrue(RewardedResultRetry.isTransientStatus(500));
        assertTrue(RewardedResultRetry.isTransientStatus(503));
    }

    @Test
    public void retriesRateLimitAndServerFailureUntilSuccess() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> {
                    int call = calls.incrementAndGet();
                    if (call == 1) return 429;
                    if (call == 2) return 503;
                    return 204;
                },
                delays::add);

        assertEquals(204, result);
        assertEquals(3, calls.get());
        assertEquals(Arrays.asList(500L, 1000L), delays);
    }

    @Test
    public void returnsLastTransientStatusAfterMaximumAttempts() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> { calls.incrementAndGet(); return 503; },
                delays::add);

        assertEquals(503, result);
        assertEquals(3, calls.get());
        assertEquals(Arrays.asList(500L, 1000L), delays);
    }

    @Test
    public void doesNotRetryPermanentClientError() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> { calls.incrementAndGet(); return 400; },
                delays::add);

        assertEquals(400, result);
        assertEquals(1, calls.get());
        assertTrue(delays.isEmpty());
    }

    @Test
    public void retriesTransportFailureAndStopsAfterThreeAttempts() {
        AtomicInteger calls = new AtomicInteger();
        List<Long> delays = new ArrayList<>();

        int result = RewardedResultRetry.deliver(
                attempt -> {
                    calls.incrementAndGet();
                    throw new IOException("simulated connection loss");
                },
                delays::add);

        assertEquals(-1, result);
        assertEquals(3, calls.get());
        assertEquals(Arrays.asList(500L, 1000L), delays);
    }

    @Test
    public void interruptionStopsFurtherAttemptsAndPreservesInterruptFlag() {
        AtomicInteger calls = new AtomicInteger();
        Thread.interrupted();

        int result = RewardedResultRetry.deliver(
                attempt -> { calls.incrementAndGet(); return 503; },
                millis -> { throw new InterruptedException("test"); });

        assertEquals(-2, result);
        assertEquals(1, calls.get());
        assertTrue(Thread.currentThread().isInterrupted());
        Thread.interrupted();
    }

    @Test
    public void onlyTransientHttpStatusesAreRetried() {
        assertFalse(RewardedResultRetry.isTransientStatus(200));
        assertFalse(RewardedResultRetry.isTransientStatus(204));
        assertFalse(RewardedResultRetry.isTransientStatus(400));
        assertFalse(RewardedResultRetry.isTransientStatus(404));
    }
}
