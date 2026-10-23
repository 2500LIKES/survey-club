 "use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = { id: string; username: string; display_name: string; wallet_number: string; role: string; is_banned: boolean };
type Survey = { id: string; title: string; description: string; reward_points: number };
type Question = { id: string; question_text: string; question_type: string; position: number };
type Option = { id: string; question_id: string; option_text: string; position: number };

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"login"|"signup">("signup");
  const [tab, setTab] = useState<"surveys"|"wallet"|"profile"|"admin">("surveys");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [wallet, setWallet] = useState("");
  const [email, setEmail] = useState("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [adminTitle, setAdminTitle] = useState("");
  const [adminDescription, setAdminDescription] = useState("");
  const [adminReward, setAdminReward] = useState("5");
  const [adminQuestion, setAdminQuestion] = useState("");
  const [adminOptionText, setAdminOptionText] = useState("ตัวเลือก A,ตัวเลือก B");
  const [adminAnswer, setAdminAnswer] = useState("ตัวเลือก A");
  const [adminSurveyId, setAdminSurveyId] = useState("");
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);
  const [adminMembers, setAdminMembers] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadUser(data.session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadUser(newSession.user.id);
      else { setProfile(null); setBalance(0); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadUser(id: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) setNotice("อ่านข้อมูลสมาชิกไม่สำเร็จ: " + error.message);
    if (data) {
      setProfile(data);
      if (data.is_banned) { await supabase.auth.signOut(); setNotice("บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแล"); return; }
      await Promise.all([loadSurveys(), loadBalance(), loadHistory(), loadSubmissions()]);
    }
  }
  async function loadSurveys() {
    const { data, error } = await supabase.from("surveys").select("id,title,description,reward_points").eq("is_published", true).order("created_at", {ascending:false});
    if (error) setNotice("โหลดงานไม่สำเร็จ: " + error.message);
    setSurveys(data || []);
  }
  async function loadBalance() {
    const { data, error } = await supabase.rpc("get_my_balance");
    if (error) setNotice("อ่านคะแนนไม่สำเร็จ: " + error.message);
    setBalance(Number(data || 0));
  }
  async function loadHistory() {
    const { data } = await supabase.from("withdrawals").select("*").order("created_at", {ascending:false}).limit(30);
    setWithdrawals(data || []);
  }
  async function loadSubmissions() {
    const { data } = await supabase.from("submissions").select("survey_id");
    setSubmissions((data || []).map((x:any) => x.survey_id));
  }
  async function authAction(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      if (mode === "signup") {
        if (!username.trim() || !displayName.trim() || !wallet.trim() || !password) throw new Error("กรอกข้อมูลให้ครบทุกช่อง");
        if (!/^[0-9]{10}$/.test(wallet.trim())) throw new Error("กรุณากรอกเบอร์ Wallet 10 หลัก");
        if (password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        const safeEmail = email.trim() || `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"") || "member"}@members.surveyclub.local`;
        const { error } = await supabase.auth.signUp({
          email: safeEmail, password,
          options: { data: { username: username.trim(), display_name: displayName.trim(), wallet_number: wallet.trim() } }
        });
        if (error) throw error;
        setNotice("สมัครแล้ว หากระบบขอให้ยืนยันอีเมล ให้ทำตามข้อความที่ Supabase ส่งให้ หากใช้อีเมลจำลอง ต้องตั้งค่า Confirm email ตามความเหมาะสมก่อนใช้งาน");
      } else {
        const loginEmail = email.trim() || `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"") || "member"}@members.surveyclub.local`;
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
      }
    } catch (err:any) { setNotice(err.message || "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }
  async function openSurvey(s: Survey) {
    setActiveSurvey(s); setAnswers({}); setNotice("");
    const { data: qs, error } = await supabase.from("questions").select("id,question_text,question_type,position").eq("survey_id", s.id).order("position");
    if (error) { setNotice(error.message); return; }
    setQuestions(qs || []);
    const ids = (qs || []).map((q:any)=>q.id);
    if (ids.length) {
      const { data: opts, error: optError } = await supabase.from("question_options").select("id,question_id,option_text,position").in("question_id", ids).order("position");
      if (optError) setNotice(optError.message);
      setOptions(opts || []);
    } else setOptions([]);
  }
  async function submitSurvey() {
    if (!activeSurvey || !session) return;
    if (!questions.length) { setNotice("งานนี้ยังไม่มีคำถาม"); return; }
    if (questions.some(q => !answers[q.id]?.trim())) { setNotice("ตอบคำถามให้ครบก่อนส่ง"); return; }
    setBusy(true); setNotice("");
    const { error } = await supabase.from("submissions").insert({
      user_id: session.user.id, survey_id: activeSurvey.id, answers, score_awarded: 0
    });
    setBusy(false);
    if (error) { setNotice(error.code === "23505" ? "คุณทำงานนี้ไปแล้ว" : "ส่งคำตอบไม่สำเร็จ: " + error.message); return; }
    setNotice("ส่งคำตอบแล้ว ระบบจะเพิ่มคะแนนเมื่อระบบตรวจคำตอบฝั่งเซิร์ฟเวอร์ได้รับการตั้งค่า");
    setActiveSurvey(null); await loadSubmissions();
  }
  async function requestWithdrawal() {
    const amount = Number(withdrawAmount);
    if (!profile) return;
    if (!Number.isInteger(amount) || amount < 100) { setNotice("ถอนขั้นต่ำ 100 บาท"); return; }
    if (amount > balance) { setNotice("คะแนนไม่พอสำหรับยอดถอนนี้"); return; }
    setBusy(true); setNotice("");
    const { error } = await supabase.from("withdrawals").insert({
      user_id: profile.id, wallet_number: profile.wallet_number, amount_baht: amount, points_used: amount, status: "pending"
    });
    setBusy(false);
    if (error) setNotice("ส่งคำขอถอนไม่สำเร็จ: " + error.message + " (ต้องตั้งค่าสิทธิ์ฐานข้อมูลก่อน)");
    else { setNotice("ส่งคำขอถอนแล้ว รอแอดมินตรวจสอบ"); setWithdrawAmount(""); await loadHistory(); }
  }
  async function loadAdmin() {
    const [w,m] = await Promise.all([
      supabase.from("withdrawals").select("*").order("created_at",{ascending:false}).limit(100),
      supabase.from("profiles").select("id,username,display_name,wallet_number,role,is_banned,created_at").order("created_at",{ascending:false}).limit(100)
    ]);
    setAdminWithdrawals(w.data || []); setAdminMembers(m.data || []);
    if (w.error || m.error) setNotice("โหลดข้อมูลแอดมินไม่ได้ ตรวจสอบสิทธิ์ RLS และบัญชีแอดมิน");
  }
  async function createSurvey() {
    if (!adminTitle.trim()) { setNotice("ใส่ชื่องานก่อน"); return; }
    const { data, error } = await supabase.from("surveys").insert({
      title: adminTitle.trim(), description: adminDescription.trim(), reward_points: Number(adminReward)||0, is_published: true
    }).select().single();
    if (error) { setNotice("สร้างงานไม่ได้: " + error.message); return; }
    setAdminSurveyId(data.id); setNotice("สร้างงานแล้ว ใส่คำถามต่อได้"); setAdminTitle(""); setAdminDescription(""); await loadSurveys();
  }
  async function addQuestion() {
    if (!adminSurveyId || !adminQuestion.trim()) { setNotice("สร้างงานและกรอกคำถามก่อน"); return; }
    const { data, error } = await supabase.from("questions").insert({
      survey_id: adminSurveyId, question_text: adminQuestion.trim(), question_type: "single_choice", position: 1
    }).select().single();
    if (error) { setNotice("เพิ่มคำถามไม่ได้: " + error.message); return; }
    const opts = adminOptionText.split(",").map(s=>s.trim()).filter(Boolean);
    if (opts.length < 2) { setNotice("ใส่ตัวเลือกอย่างน้อย 2 ข้อ คั่นด้วยเครื่องหมายจุลภาค"); return; }
    const rows = opts.map((option_text, i)=>({question_id:data.id, option_text, position:i+1, is_correct:option_text===adminAnswer.trim()}));
    const { error: optError } = await supabase.from("question_options").insert(rows);
    if (optError) setNotice("เพิ่มตัวเลือกไม่ได้: " + optError.message);
    else { setNotice("เพิ่มคำถามและตัวเลือกแล้ว"); setAdminQuestion(""); }
  }
  async function adminDecision(row:any, status:"approved"|"rejected") {
    setNotice("การอนุมัติ/ปฏิเสธต้องทำผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์ที่ตรวจสิทธิ์และจัดการคืนคะแนนอย่างปลอดภัย ยังไม่เปิดให้แก้สถานะจากหน้าเว็บโดยตรง");
  }
  async function signOut() { await supabase.auth.signOut(); setNotice("ออกจากระบบแล้ว"); }
  const isAdmin = profile?.role === "admin";
  const nav = [{id:"surveys",label:"แบบสอบถาม",icon:"▤"},{id:"wallet",label:"คะแนน/ถอน",icon:"฿"},{id:"profile",label:"บัญชี",icon:"♙"}] as const;

  if (!session) return <main className="authPage">
    <section className="authHero"><div className="logoMark">S</div><div className="eyebrow">SURVEY CLUB</div><h1>ตอบคำถาม<br/><span>สะสมคะแนน</span></h1><p>พื้นที่รวมแบบสอบถามและคะแนนสะสมของคุณ</p><div className="heroPills"><span>✓ ทำได้บนมือถือ</span><span>✓ บัญชีเดียวหลายเครื่อง</span></div></section>
    <section className="authCard"><div className="cardTop"><span className="tinyLabel">ยินดีต้อนรับ</span><h2>{mode==="signup"?"สร้างบัญชีใหม่":"เข้าสู่ระบบ"}</h2><p>ข้อมูลจะบันทึกไว้ในฐานข้อมูลออนไลน์</p></div>
      <div className="switcher"><button className={mode==="signup"?"selected":""} onClick={()=>setMode("signup")}>สมัครสมาชิก</button><button className={mode==="login"?"selected":""} onClick={()=>setMode("login")}>เข้าสู่ระบบ</button></div>
      <form onSubmit={authAction} className="form">
        {mode==="signup" && <><label>ชื่อที่ใช้เข้าสู่ระบบ<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="เช่น somchai" autoComplete="username" required/></label><label>ชื่อที่แสดง<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="ชื่อสมาชิก" required/></label><label>เบอร์ TrueMoney Wallet<input value={wallet} onChange={e=>setWallet(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="08xxxxxxxx" inputMode="numeric" required/><small>เบอร์นี้จะใช้เป็นข้อมูลรับเงินและแก้เองไม่ได้</small></label></>}
        <label>อีเมล (ใช้สำหรับบัญชี)<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="อีเมล ถ้ามี" type="email" autoComplete="email"/></label>
        <label>ชื่อผู้ใช้<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="ชื่อผู้ใช้" autoComplete="username" required={mode==="login"}/></label>
        <label>รหัสผ่าน<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="อย่างน้อย 8 ตัวอักษร" autoComplete={mode==="signup"?"new-password":"current-password"} required/></label>
        <button className="primaryBtn" disabled={busy}>{busy?"กำลังดำเนินการ...":mode==="signup"?"สมัครสมาชิก":"เข้าสู่ระบบ"} <span>→</span></button>
      </form>
      {notice && <div className="notice">{notice}</div>}
      <p className="legal">อย่าใช้รหัสผ่านเดียวกับบัญชีสำคัญอื่น และอย่าเผยแพร่ข้อมูล Wallet ของผู้อื่น</p>
    </section>
  </main>;

  return <main className="appShell">
    <header className="topbar"><div className="brand"><div className="logoSmall">S</div><div><b>Survey Club</b><small>ตอบง่าย สะสมคะแนน</small></div></div><div className="userChip"><span className="onlineDot"></span>{profile?.display_name || profile?.username || "สมาชิก"}</div></header>
    <section className="welcome"><div><span className="eyebrow light">พื้นที่สมาชิก</span><h1>สวัสดี, {profile?.display_name || profile?.username || "สมาชิก"} 👋</h1><p>วันนี้มีแบบสอบถามให้คุณเลือกทำ</p></div><div className="balanceCard"><span>คะแนนของคุณ</span><strong>{balance.toLocaleString("th-TH")} <small>คะแนน</small></strong><em>1 คะแนน = 1 บาท ตามอัตราที่ตั้งไว้</em></div></section>
    <div className="content">
      <div className="desktopNav">{nav.map(n=><button key={n.id} className={tab===n.id?"active":""} onClick={()=>setTab(n.id)}><span>{n.icon}</span>{n.label}</button>)}{isAdmin&&<button className={tab==="admin"?"active":""} onClick={()=>{setTab("admin");loadAdmin()}}><span>⚙</span>แอดมิน</button>}</div>
      {notice && <div className="notice appNotice"><span>{notice}</span><button onClick={()=>setNotice("")}>ปิด</button></div>}
      {tab==="surveys" && <section><div className="sectionHead"><div><span className="tinyLabel">เลือกงานที่สนใจ</span><h2>แบบสอบถามทั้งหมด</h2></div><button className="outlineBtn" onClick={loadSurveys}>↻ รีเฟรช</button></div>
        {activeSurvey ? <div className="surveyForm"><button className="backBtn" onClick={()=>setActiveSurvey(null)}>← กลับไปงานทั้งหมด</button><h2>{activeSurvey.title}</h2><p>{activeSurvey.description}</p>{questions.map(q=><div className="questionBox" key={q.id}><h3>{q.question_text}</h3>{options.filter(o=>o.question_id===q.id).map(o=><label className="option" key={o.id}><input type="radio" name={q.id} value={o.id} checked={answers[q.id]===o.id} onChange={()=>setAnswers({...answers,[q.id]:o.id})}/>{o.option_text}</label>)}</div>)}<button className="primaryBtn" onClick={submitSurvey} disabled={busy}>ส่งคำตอบ <span>→</span></button></div>
        : surveys.length===0?<div className="empty"><div>▤</div><h3>ยังไม่มีงานเปิดรับ</h3><p>เมื่อแอดมินเพิ่มแบบสอบถาม งานจะแสดงที่นี่</p></div>
        : <div className="surveyGrid">{surveys.map((s,i)=><article className="surveyCard" key={s.id}><div className="surveyIcon">{["✦","◉","▧","✳"][i%4]}</div><div className="surveyMeta"><span>แบบสอบถาม</span><b>+{s.reward_points} คะแนน</b></div><h3>{s.title}</h3><p>{s.description||"ร่วมตอบคำถามเพื่อสะสมคะแนน"}</p><div className="surveyFooter"><span>{submissions.includes(s.id)?"✓ ทำแล้ว":"ประมาณ 2–5 นาที"}</span><button disabled={submissions.includes(s.id)} onClick={()=>openSurvey(s)}>{submissions.includes(s.id)?"เสร็จแล้ว":"เริ่มทำ →"}</button></div></article>)}</div>}
      </section>}
      {tab==="wallet" && <section><div className="sectionHead"><div><span className="tinyLabel">คะแนนสะสม</span><h2>คะแนนและการถอน</h2></div></div><div className="walletLayout"><div className="walletPanel"><div className="walletIcon">฿</div><span>คะแนนที่ใช้แลกได้</span><strong>{balance.toLocaleString("th-TH")} <small>คะแนน</small></strong><p>ถอนขั้นต่ำ 100 คะแนน = 100 บาท</p><label>จำนวนเงินที่ต้องการถอน<input type="number" min="100" step="1" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} placeholder="ระบุจำนวนบาท"/></label><div className="walletLocked"><span>เบอร์ Wallet ที่ลงทะเบียน</span><b>{profile?.wallet_number || "ไม่พบเบอร์ Wallet"}</b><small>ล็อกไว้ตามข้อมูลตอนสมัคร</small></div><button className="primaryBtn" onClick={requestWithdrawal} disabled={busy}>ส่งคำขอถอน <span>→</span></button></div><div className="historyPanel"><h3>ประวัติการถอน</h3>{withdrawals.length===0?<div className="empty compact"><p>ยังไม่มีประวัติการถอน</p></div>:withdrawals.map(w=><div className="historyRow" key={w.id}><div><b>{Number(w.amount_baht).toLocaleString()} บาท</b><small>{new Date(w.created_at).toLocaleString("th-TH")}</small><small>Wallet: {w.wallet_number}</small></div><span className={"status "+w.status}>{w.status==="pending"?"รอตรวจสอบ":w.status==="approved"?"อนุมัติแล้ว":"ปฏิเสธ"}</span></div>)}</div></div></section>}
      {tab==="profile" && <section><div className="sectionHead"><div><span className="tinyLabel">บัญชีของคุณ</span><h2>ข้อมูลสมาชิก</h2></div></div><div className="profilePanel"><div className="avatar">{(profile?.display_name||profile?.username||"S").slice(0,1).toUpperCase()}</div><div className="profileDetails"><h3>{profile?.display_name}</h3><p>@{profile?.username}</p><div className="detailRow"><span>เบอร์ Wallet</span><b>{profile?.wallet_number}</b></div><div className="detailRow"><span>ประเภทบัญชี</span><b>{profile?.role==="admin"?"ผู้ดูแล":"สมาชิก"}</b></div><div className="detailRow"><span>คะแนนปัจจุบัน</span><b>{balance.toLocaleString()} คะแนน</b></div><button className="dangerBtn" onClick={signOut}>ออกจากระบบ</button></div></div></section>}
      {tab==="admin" && isAdmin && <section><div className="sectionHead"><div><span className="tinyLabel">จัดการเว็บไซต์</span><h2>แผงควบคุมแอดมิน</h2></div><button className="outlineBtn" onClick={loadAdmin}>↻ รีเฟรช</button></div><div className="adminGrid"><div className="adminPanel"><h3>＋ สร้างงานใหม่</h3><label>ชื่องาน<input value={adminTitle} onChange={e=>setAdminTitle(e.target.value)} placeholder="เช่น แบบสอบถามเกม"/></label><label>คำอธิบาย<input value={adminDescription} onChange={e=>setAdminDescription(e.target.value)} placeholder="รายละเอียดงาน"/></label><label>คะแนนรางวัล<input type="number" min="0" value={adminReward} onChange={e=>setAdminReward(e.target.value)}/></label><button className="primaryBtn" onClick={createSurvey}>สร้างงาน</button><hr/><h3>＋ เพิ่มคำถามในงาน</h3><label>รหัสงาน (UUID)<input value={adminSurveyId} onChange={e=>setAdminSurveyId(e.target.value)} placeholder="วาง ID งานที่สร้าง"/></label><label>คำถาม<input value={adminQuestion} onChange={e=>setAdminQuestion(e.target.value)} placeholder="คำถาม"/></label><label>ตัวเลือก (คั่นด้วย ,)<input value={adminOptionText} onChange={e=>setAdminOptionText(e.target.value)}/></label><label>ข้อความคำตอบที่ถูกต้อง<input value={adminAnswer} onChange={e=>setAdminAnswer(e.target.value)}/></label><button className="outlineBtn" onClick={addQuestion}>เพิ่มคำถาม</button><small>สำหรับงานจริง ควรตรวจคำตอบและให้คะแนนผ่านฟังก์ชันฝั่งเซิร์ฟเวอร์เท่านั้น</small></div><div className="adminPanel"><h3>คำขอถอนล่าสุด</h3>{adminWithdrawals.map(w=><div className="adminRow" key={w.id}><div><b>{w.amount_baht} บาท</b><small>{w.wallet_number}</small><small>{w.user_id}</small></div><span className={"status "+w.status}>{w.status}</span><button className="miniBtn" onClick={()=>adminDecision(w,"approved")}>ตรวจสอบ</button></div>)}<h3>สมาชิก (สูงสุด 100 รายการ)</h3>{adminMembers.map(m=><div className="adminRow" key={m.id}><div><b>{m.display_name||m.username}</b><small>@{m.username} · {m.wallet_number}</small></div><span>{m.is_banned?"ระงับ":"ปกติ"}</span></div>)}</div></div></section>}
    </div>
    <nav className="mobileNav">{nav.map(n=><button key={n.id} className={tab===n.id?"active":""} onClick={()=>setTab(n.id)}><span>{n.icon}</span>{n.label}</button>)}{isAdmin&&<button className={tab==="admin"?"active":""} onClick={()=>{setTab("admin");loadAdmin()}}><span>⚙</span>แอดมิน</button>}</nav>
    <footer>Survey Club <span>•</span> ข้อมูลสมาชิกจัดเก็บในฐานข้อมูลออนไลน์</footer>
  </main>;
}