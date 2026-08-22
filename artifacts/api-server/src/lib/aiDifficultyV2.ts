export type AiDifficulty = "easy" | "expert";
export interface AiPlanEntry { category: string; readyAtMs: number; shouldAnswer: boolean; }
const CONFIG: Record<AiDifficulty,{minMs:number;maxMs:number;accuracyMin:number;accuracyMax:number}>={easy:{minMs:1500,maxMs:4000,accuracyMin:.4,accuracyMax:.6},expert:{minMs:500,maxMs:1500,accuracyMin:.8,accuracyMax:.95}};
const randomBetween=(min:number,max:number)=>min+Math.random()*(max-min);
export function createAiRoundPlan(categories:string[],difficulty:AiDifficulty="easy",elapsedMs=60000):AiPlanEntry[]{const c=CONFIG[difficulty];const target=Math.round(categories.length*randomBetween(c.accuracyMin,c.accuracyMax));const ok=new Set<number>();while(ok.size<target&&ok.size<categories.length)ok.add(Math.floor(Math.random()*categories.length));return categories.map((category,index)=>({category,readyAtMs:Math.round(randomBetween(c.minMs,c.maxMs)),shouldAnswer:ok.has(index)&&elapsedMs>=0}));}
export function shouldAiAnswer(plan:AiPlanEntry[],category:string):boolean{const e=plan.find(x=>x.category===category);return !!e?.shouldAnswer;}
