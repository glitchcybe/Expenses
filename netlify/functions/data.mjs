import { createClient } from "@supabase/supabase-js";
const headers = { "content-type": "application/json", "cache-control": "no-store" };
const appId = process.env.APP_ID || "home";
const res = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
function env(name){ const v=process.env[name]; if(!v) throw new Error(`Missing Netlify environment variable: ${name}`); return v; }
function client(){ return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth:{persistSession:false,autoRefreshToken:false} }); }
function nextMonth(month){ const [y,m]=month.split("-").map(Number); return new Date(Date.UTC(y,m,1)).toISOString().slice(0,10); }
async function ensure(supabase){
  await supabase.from("expense_app_settings").upsert({app_id:appId,currency:"RON",monthly_budget:0,economy_target:0},{onConflict:"app_id",ignoreDuplicates:true});
  await supabase.from("expense_app_users").upsert([{app_id:appId,name:"AMINE",monthly_income:0,color:"#4f46e5"},{app_id:appId,name:"ALINA",monthly_income:0,color:"#10b981"}],{onConflict:"app_id,name",ignoreDuplicates:true});
  await supabase.from("expense_merchants").upsert([{app_id:appId,name:"Salary",logo_url:"",website_domain:""},{app_id:appId,name:"Cash",logo_url:"",website_domain:""}],{onConflict:"app_id,name",ignoreDuplicates:true});
}
async function load(supabase){
  await ensure(supabase);
  const [settings,users,merchants,transactions,credits] = await Promise.all([
    supabase.from("expense_app_settings").select("*").eq("app_id",appId).single(),
    supabase.from("expense_app_users").select("*").eq("app_id",appId).order("name"),
    supabase.from("expense_merchants").select("*").eq("app_id",appId).order("name"),
    supabase.from("expense_transactions").select("*").eq("app_id",appId).order("tx_date",{ascending:false}).order("created_at",{ascending:false}),
    supabase.from("expense_credits").select("*").eq("app_id",appId).order("created_at",{ascending:false})
  ]);
  for (const r of [settings,users,merchants,transactions,credits]) if (r.error) throw r.error;
  return { settings:settings.data, users:users.data, merchants:merchants.data, transactions:transactions.data, credits:credits.data };
}
export const handler = async (event) => {
  try{
    if(event.httpMethod === "OPTIONS") return res(204,{});
    const supabase = client();
    if(event.httpMethod === "GET") return res(200, await load(supabase));
    if(event.httpMethod !== "POST") return res(405,{error:"Method not allowed"});
    const b = JSON.parse(event.body || "{}");
    if(b.action === "load") return res(200, await load(supabase));
    if(b.action === "updateSettings"){
      const {currency,monthly_budget,economy_target}=b;
      const {error}=await supabase.from("expense_app_settings").upsert({app_id:appId,currency:currency||"RON",monthly_budget:Number(monthly_budget||0),economy_target:Number(economy_target||0),updated_at:new Date().toISOString()},{onConflict:"app_id"});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "addUser"){
      if(!b.name) return res(400,{error:"User name is required"});
      const {error}=await supabase.from("expense_app_users").insert({app_id:appId,name:String(b.name).trim().toUpperCase(),monthly_income:0});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "updateUser"){
      const {error}=await supabase.from("expense_app_users").update({monthly_income:Number(b.monthly_income||0)}).eq("app_id",appId).eq("id",b.id);
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "addMerchant"){
      if(!b.name) return res(400,{error:"Merchant name is required"});
      const {error}=await supabase.from("expense_merchants").upsert({app_id:appId,name:String(b.name).trim(),website_domain:b.website_domain||"",logo_url:b.logo_url||"",logo_data:b.logo_data||""},{onConflict:"app_id,name"});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "deleteMerchant"){
      const count = await supabase.from("expense_transactions").select("*",{count:"exact",head:true}).eq("app_id",appId).eq("merchant_id",b.id);
      if(count.error) throw count.error; if(count.count>0) return res(409,{error:"This merchant is used in transactions."});
      const {error}=await supabase.from("expense_merchants").delete().eq("app_id",appId).eq("id",b.id); if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "addTransaction"){
      const {userId,merchantId,type,amount,category,tx_date,note}=b;
      if(!userId||!merchantId||!type||!amount||!tx_date) return res(400,{error:"Choose user, merchant, amount and date."});
      const {error}=await supabase.from("expense_transactions").insert({app_id:appId,user_id:userId,merchant_id:merchantId,type,amount:Number(amount),category:category||(type==="income"?"Income":"Other"),tx_date,note:note||""});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "deleteTransaction"){
      const {error}=await supabase.from("expense_transactions").delete().eq("app_id",appId).eq("id",b.id); if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "addMonthlyIncome"){
      const start=`${b.month}-01`, end=nextMonth(b.month);
      const user=await supabase.from("expense_app_users").select("*").eq("app_id",appId).eq("id",b.userId).single(); if(user.error) throw user.error;
      if(!Number(user.data.monthly_income)) return res(400,{error:`Set default income for ${user.data.name} first.`});
      const existing=await supabase.from("expense_transactions").select("id").eq("app_id",appId).eq("user_id",b.userId).eq("type","income").eq("category","Income").gte("tx_date",start).lt("tx_date",end).limit(1); if(existing.error) throw existing.error;
      if(existing.data?.length) return res(409,{error:`Income already exists for ${user.data.name} in ${b.month}.`});
      let merchant=await supabase.from("expense_merchants").select("*").eq("app_id",appId).eq("name","Salary").maybeSingle(); if(merchant.error) throw merchant.error;
      if(!merchant.data){ merchant=await supabase.from("expense_merchants").insert({app_id:appId,name:"Salary",logo_url:"",website_domain:""}).select("*").single(); if(merchant.error) throw merchant.error; }
      const {error}=await supabase.from("expense_transactions").insert({app_id:appId,user_id:user.data.id,merchant_id:merchant.data.id,type:"income",amount:Number(user.data.monthly_income),category:"Income",tx_date:start,note:`Monthly income ${b.month}`});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "addCredit"){
      if(!b.name || !b.monthly_payment) return res(400,{error:"Credit name and monthly payment are required."});
      const {error}=await supabase.from("expense_credits").insert({app_id:appId,name:String(b.name).trim(),credit_type:b.credit_type||"Other credit",monthly_payment:Number(b.monthly_payment||0),remaining_amount:Number(b.remaining_amount||0),interest_rate:b.interest_rate===""?null:b.interest_rate,end_date:b.end_date||null,note:b.note||"",is_active:true});
      if(error) throw error; return res(200,{ok:true});
    }
    if(b.action === "deleteCredit"){
      const {error}=await supabase.from("expense_credits").delete().eq("app_id",appId).eq("id",b.id); if(error) throw error; return res(200,{ok:true});
    }
    return res(400,{error:`Unknown action: ${b.action}`});
  }catch(e){ console.error(e); return res(500,{error:e.message||"Server error"}); }
};
