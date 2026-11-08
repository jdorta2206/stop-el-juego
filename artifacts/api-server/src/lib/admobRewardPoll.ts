export type AdmobPollRow = {
  client_state?: string | null;
};

/**
 * A missing or pending SSV record is never proof of a reward.
 * Preserve the client signal so the TWA can offer a later SSV recheck.
 */
export function buildAdmobPendingResponse(row?: AdmobPollRow | null): {
  ready: false;
  clientState?: string;
} {
  return {
    ready: false,
    ...(typeof row?.client_state === "string" ? { clientState: row.client_state } : {}),
  };
}
