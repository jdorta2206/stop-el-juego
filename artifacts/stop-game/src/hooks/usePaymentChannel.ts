import { useEffect, useState } from "react";
import { detectPaymentChannel, isLikelyPlayTwa } from "@/lib/playBilling";
export type PaymentChannel = "play" | "stripe";
export function usePaymentChannel(){
  const[channel,setChannel]=useState<PaymentChannel|"loading">("loading");
  useEffect(()=>{let cancelled=false;const startedAt=Date.now();const resolve=()=>{if(cancelled)return;if(isLikelyPlayTwa()){setChannel("play");return}if(Date.now()-startedAt<3000){window.setTimeout(resolve,100)}else{void detectPaymentChannel().then(value=>{if(!cancelled)setChannel(value)}).catch(()=>{if(!cancelled)setChannel("stripe")})}};resolve();return()=>{cancelled=true}},[]);
  return{channel,isPlay:channel==="play",isReady:channel!=="loading"};
}
