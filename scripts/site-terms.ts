import {usageRates,usageBilling} from "../packages/usage/src/ledger.ts"
export const siteTerms={allowance:usageRates.allowance.toLocaleString("en-US"),agentRate:String(usageRates["user-agent"]),airaRate:String(usageRates.aira),freePrice:`$${usageBilling.weeklyPriceCents/100}`,minimumPurchase:`$${usageBilling.minimumPurchaseCents/100}`}
export function renderSiteTerms(source:string){return source.replace(/\{\{(\w+)\}\}/g,(_match,key:string)=>{if(!(key in siteTerms))throw new Error(`Unknown public amount ${key}`);return siteTerms[key as keyof typeof siteTerms]})}
