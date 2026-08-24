import { Router } from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { issuePlayerToken } from "../lib/playerAuth";

const router = Router();
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
type AppleJwk={kid?:string;kty?:string;alg?:string;use?:string;n?:string;e?:string};
type AppleClaims={sub:string;email?:string;email_verified?:boolean|string;nonce?:string;iss:string;aud:string;exp:number;iat?:number};

async function getApplePublicKey(identityToken:string){
  const decoded=jwt.decode(identityToken,{complete:true});
  if(!decoded||typeof decoded!=="object"||!decoded.header?.kid)throw new Error("Invalid Apple identity token header");
  const response=await fetch(APPLE_KEYS_URL); if(!response.ok)throw new Error(`Apple keys request failed: ${response.status}`);
  const data=await response.json() as {keys?:AppleJwk[]}; const jwk=data.keys?.find(key=>key.kid===decoded.header.kid);
  if(!jwk?.n||!jwk.e||jwk.kty!=="RSA")throw new Error("Apple signing key not found");
  return crypto.createPublicKey({key:jwk,format:"jwk"});
}

// Native iOS Sign in with Apple bridge. The server verifies Apple's signature,
// issuer, audience and nonce before issuing the normal STOP session token.
router.post("/apple/native",async(req:Request,res:Response)=>{
  const identityToken=typeof req.body?.identityToken==="string"?req.body.identityToken:"";
  const nonce=typeof req.body?.nonce==="string"?req.body.nonce:"";
  const suppliedEmail=typeof req.body?.email==="string"?req.body.email:"";
  const suppliedName=typeof req.body?.name==="string"?req.body.name:"";
  const clientId=process.env["APPLE_IOS_CLIENT_ID"]||process.env["APPLE_CLIENT_ID"];
  if(!identityToken||!nonce)return res.status(400).json({error:"identityToken and nonce are required"});
  if(!clientId)return res.status(503).json({error:"Apple Sign-In is not configured"});
  try{
    const publicKey=await getApplePublicKey(identityToken);
    const claims=jwt.verify(identityToken,publicKey,{algorithms:["RS256"],issuer:APPLE_ISSUER,audience:clientId}) as AppleClaims;
    if(!claims.sub||claims.iss!==APPLE_ISSUER||claims.aud!==clientId)throw new Error("Invalid Apple identity claims");
    if(!claims.nonce||claims.nonce!==nonce)throw new Error("Invalid Apple nonce");
    const playerId=`apple_${claims.sub}`;
    const sessionToken=issuePlayerToken(res,playerId);
    if(!sessionToken)return res.status(503).json({error:"Server auth not configured"});
    const name=suppliedName.trim()||"Apple User";
    const email=claims.email||suppliedEmail.trim()||null;
    return res.json({ok:true,user:{id:playerId,name,email,picture:null,provider:"apple"},token:sessionToken});
  }catch(error){console.error("[auth/apple/native] verification failed:",error);return res.status(401).json({error:"Invalid Apple identity token"});}
});
export default router;
