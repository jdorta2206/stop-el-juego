import { getApiUrl, authHeaders } from "@/lib/utils";
const API_BASE=getApiUrl();
export const WORLD_CUP_PACK_SKU="pack_mundial";
export const WORLD_CUP_PACK_PRICE_LABEL="2,99 €";

/** Create the real Stripe Checkout session for the World Cup pack on web. */
export async function startPackCheckout(opts:{playerId:string;email?:string}):Promise<{url:string}>{
  const res=await fetch(`${API_BASE}/api/stripe/checkout-pack`,{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},credentials:"include",body:JSON.stringify({playerId:opts.playerId,email:opts.email,sku:WORLD_CUP_PACK_SKU})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||typeof data.url!=="string")throw new Error(data.error||"No se pudo iniciar el pago del Pack Mundial.");
  return{url:data.url};
}

export async function claimStripePack(opts:{playerId:string;sessionId?:string}):Promise<{granted:boolean}>{
  const res=await fetch(`${API_BASE}/api/stripe/claim-pack`,{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},credentials:"include",body:JSON.stringify(opts)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||"Claim failed");
  return data as {granted:boolean};
}
