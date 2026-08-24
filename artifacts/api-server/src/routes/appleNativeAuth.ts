import { Router } from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { issuePlayerToken } from "../lib/playerAuth";
const router=Router();
const APPLE_ISSUER="https://appleid.apple.com";
const APPLE_KEYS_URL="https://appleid.apple.com/auth/keys";
type AppleJwk={kid?:string;kty?:string;n?:string;e?:string};
type AppleClaims={sub:string;email?:string;nonce?:string;iss:string;aud:string;exp:number};
async function getApplePublicKey(token:string){const decoded=jwt.decode(token,{complete:true});if(!decoded||typeof decoded!=="object"||!decoded.header?.kid)throw new Error("Invalid Apple identity token header");const response=await fetch(APPLE_KEYS_URL);if(!response.ok)throw new Error("Apple keys request failed");const data=await response.json() as {keys?:AppleJwk[]};const jwk=data.keys?.find(k=>k.kid===decoded.header.kid);if(!jwk?.n||!jwk.e||jwk.kty!=="RSA")throw new Error("Apple signing key not found");return crypto.createPublicKey({key:jwk,format:"jwk"});}
router.post("/apple/native",async(req:Request,res:Response)=>{const identityToken=typeof req.body?.identityToken==="string"?req.body.identityToken:"";const nonce=typeof req.body?.nonce==="string"?req.body.nonce:"";const email=typeof req.body?.email==="string"?req.body.email:"";const name=typeof req.body?.name==="string"?req.body.name:"";const clientId=process.env["APPLE_IOS_CLIENT_ID"]||process.env["APPLE_CLIENT_ID"];if(!identityToken||!nonce)return res.status(400).json({error:"identityToken and nonce are required"});if(!clientId)return res.status(503).json({error:"Apple Sign-In is not configured"});try{const key=await getApplePublicKey(identityToken);const claims=jwt.verify(identityToken,key,{algorithms:["RS256"],issuer:APPLE_ISSUER,audience:clientId}) as AppleClaims;if(claims.nonce!==nonce)throw new Error("Invalid Apple nonce");const token=issuePlayerToken(res,`apple_${claims.sub}`);if(!token)return res.status(503).json({error:"Server auth not configured"});return res.json({ok:true,user:{id:`apple_${claims.sub}`,name:name.trim()||"Apple User",email:claims.email||email||null,picture:null,provider:"apple"},token});}catch(error){console.error("[auth/apple/native] verification failed:",error);return res.status(401).json({error:"Invalid Apple identity token"});}});
export default router;
