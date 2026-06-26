"use client";

import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase";

const TIERS = [
  { name: "S+", color: "#F59E0B", min: 94 },
  { name: "S",  color: "#F59E0B", min: 87 },
  { name: "S-", color: "#F59E0B", min: 80 },
  { name: "A+", color: "#F97316", min: 75 },
  { name: "A",  color: "#F97316", min: 70 },
  { name: "A-", color: "#F97316", min: 65 },
  { name: "B+", color: "#22C55E", min: 60 },
  { name: "B",  color: "#22C55E", min: 55 },
  { name: "B-", color: "#22C55E", min: 50 },
  { name: "C+", color: "#60A5FA", min: 45 },
  { name: "C",  color: "#60A5FA", min: 40 },
  { name: "C-", color: "#60A5FA", min: 35 },
  { name: "D+", color: "#94A3B8", min: 30 },
  { name: "D",  color: "#94A3B8", min: 25 },
  { name: "D-", color: "#94A3B8", min: 20 },
  { name: "E+", color: "#475569", min: 14 },
  { name: "E",  color: "#475569", min: 7  },
  { name: "E-", color: "#475569", min: 0  },
];

interface Player {
  id: string; name: string; position: string;
  wins: number; losses: number; mvp: number; win_rate: number; avg_points: number;
  signature: string; best_score: number; duel_wins: number; duel_losses: number;
}
interface Game {
  id: string; created_at: string;
  score_a: number; score_b: number;
  team_a: string[]; team_b: string[];
  winner: string; mvp: string | null;
  player_scores: Record<string, number>;
}
interface Duel {
  id: string; created_at: string;
  player_a: string; player_b: string;
  score_a: number; score_b: number;
  winner: string;
}

function getTier(p: Player) {
  const g = p.wins + p.losses;
  if (g < 3) return null;
  const score = p.win_rate * 0.7 + Math.min(p.mvp / 10, 1) * 100 * 0.3;
  return TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1];
}
function getTierScore(p: Player) {
  const g = p.wins + p.losses;
  if (g < 3) return null;
  return Math.round(p.win_rate * 0.7 + Math.min(p.mvp / 10, 1) * 100 * 0.3);
}
function getNextTier(p: Player) {
  const score = getTierScore(p);
  if (score === null) return null;
  const idx = TIERS.findIndex(t => score >= t.min);
  if (idx === 0) return null;
  return { tier: TIERS[idx - 1], gap: TIERS[idx - 1].min - score };
}
function uid() { return crypto.randomUUID(); }
const POSITIONS = ["PG","SG","SF","PF","C"];

const TITLES: {label:string; color:string; check:(p:Player, streak:{type:"W"|"L",count:number}|null, mvpCount:number, allPlayers:Player[])=>boolean}[] = [
  { label:"사기캐 논란",      color:"#F59E0B", check:(_,s)=>s?.type==="W"&&s.count>=5 },
  { label:"요즘 미친듯",      color:"#FF6200", check:(_,s)=>!!(s?.type==="W"&&s.count>=3) },
  { label:"이쯤되면 재능없는거", color:"#475569", check:(_,s)=>!!(s?.type==="L"&&s.count>=5) },
  { label:"슬럼프 아닌 실력",   color:"#475569", check:(_,s)=>!!(s?.type==="L"&&s.count>=3) },
  { label:"MVP 도둑",         color:"#F59E0B", check:(_,__,mvp)=>mvp>=5 },
  { label:"이거 실화냐",      color:"#F59E0B", check:(p)=>(p.wins+p.losses)>=5&&(p.win_rate??0)>=75 },
  { label:"그나마 할줄앎",    color:"#60A5FA", check:(p)=>(p.wins+p.losses)>=5&&(p.win_rate??0)>=60 },
  { label:"걸어다니는 쓰레기", color:"#475569", check:(p)=>(p.wins+p.losses)>=5&&(p.win_rate??0)<=25 },
  { label:"지면 얘 탓",       color:"#475569", check:(p)=>(p.wins+p.losses)>=5&&(p.win_rate??0)<=40 },
  { label:"인생이 농구",      color:"#60A5FA", check:(p,_,__,all)=>{const max=Math.max(...all.map(x=>x.wins+x.losses));return(p.wins+p.losses)===max&&max>=20;} },
  { label:"검증 안됨",        color:"#444",    check:(p)=>(p.wins+p.losses)<3 },
  { label:"없으나마나",        color:"#444",    check:()=>true },
];
function getAllTimeMaxStreak(playerId: string, games: Game[], type: "W"|"L"): number {
  const pg = [...games]
    .filter(g=>[...(g.team_a||[]),...(g.team_b||[])].includes(playerId))
    .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
  let max=0, cur=0;
  for (const g of pg) {
    const inA=(g.team_a||[]).includes(playerId);
    const won=(inA&&g.winner==="A")||(!inA&&g.winner==="B");
    const hit=type==="W"?won:!won;
    if(hit){cur++;max=Math.max(max,cur);}else cur=0;
  }
  return max;
}

function getTitle(p: Player, games: Game[], allPlayers: Player[]): {label:string;color:string} {
  const streak = getStreak(p.id, games);
  const mvpCount = games.filter(g=>g.mvp===p.id).length;
  return TITLES.find(t=>t.check(p, streak, mvpCount, allPlayers))!;
}

function getStreak(playerId: string, games: Game[]): {type:"W"|"L", count:number}|null {
  const pg = [...games]
    .filter(g=>[...(g.team_a||[]),...(g.team_b||[])].includes(playerId))
    .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  if(pg.length<2) return null;
  const res=(g:Game)=>{const inA=(g.team_a||[]).includes(playerId);return((inA&&g.winner==="A")||(!inA&&g.winner==="B"))?"W":"L";};
  const first=res(pg[0]);
  let count=1;
  for(let i=1;i<pg.length;i++){if(res(pg[i])===first)count++;else break;}
  return count>=2?{type:first,count}:null;
}

function Sparkline({values,color}:{values:number[],color:string}) {
  if(values.length<3) return null;
  const w=60,h=18;
  const min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const pts=values.map((v,i)=>`${(i/(values.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  return <svg width={w} height={h} style={{overflow:"visible",flexShrink:0}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g, d] = await Promise.all([
        sb.get("players", "?order=win_rate.desc"),
        sb.get("games", "?order=created_at.desc"),
        sb.get("duels", "?order=created_at.desc"),
      ]);
      setPlayers(p ?? []); setGames(g ?? []); setDuels(d ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={S.loadWrap}>
      <GlobalStyle />
      <div style={{fontSize:32,marginBottom:8}}>🏀</div>
      <span style={S.loadText}>LOADING</span>
    </div>
  );

  if (selectedPlayer) {
    const fresh = players.find(p => p.id === selectedPlayer.id) ?? selectedPlayer;
    return (
      <div style={S.root}>
        <GlobalStyle />
        <header style={S.header}>
          <div style={S.headerInner}>
            <button style={{...S.backBtn,fontSize:20,fontWeight:300,padding:"4px 8px",width:40}} onClick={() => setSelectedPlayer(null)}>‹</button>
            <span style={S.logoText}>HOOPS</span>
            <div style={{width:40}} />
          </div>
        </header>
        <main style={S.main}>
          <ProfilePage player={fresh} games={games} duels={duels} players={players} onReload={load} />
        </main>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <GlobalStyle />
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoIcon}>🏀</span>
            <span style={S.logoText}>HOOPS</span>
          </div>
          <span style={S.headerSub}>{games.length}G / {players.length}P</span>
        </div>
      </header>
      {error && <div style={S.errorBar}>{error}<button style={S.errX} onClick={() => setError("")}>✕</button></div>}
      <nav style={S.nav}>
        <div style={S.navInner}>
          {[["home","홈"],["players","선수"],["record","기록"],["duel","1vs1"],["log","경기"]].map(([k,v]) => (
            <button key={k} style={{...S.navBtn, ...(tab===k ? S.navOn : {})}} onClick={() => setTab(k)}>{v}</button>
          ))}
        </div>
      </nav>
      <main style={S.main}>
        {tab === "home"    && <Home players={players} games={games} duels={duels} onSelectPlayer={setSelectedPlayer} onGoToLog={()=>setTab("log")} />}
        {tab === "players" && <Players players={players} games={games} onReload={load} onSelectPlayer={setSelectedPlayer} />}
        {tab === "record"  && <RecordGame players={players} onReload={load} />}
        {tab === "duel"    && <DuelTab players={players} duels={duels} onReload={load} onSelectPlayer={setSelectedPlayer} />}
        {tab === "log"     && <Log games={games} players={players} onReload={load} />}
      </main>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────────────────────────
function ProfilePage({ player, games, duels, players, onReload }: {
  player: Player; games: Game[]; duels: Duel[]; players: Player[]; onReload: () => void;
}) {
  const [editSig, setEditSig] = useState(false);
  const [sig, setSig] = useState(player.signature || "");
  const [savingSig, setSavingSig] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [player.id]);

  const tier = getTier(player);
  const nextTier = getNextTier(player);
  const tierScore = getTierScore(player);
  const totalGames = player.wins + player.losses;

  // 최근 5경기 폼
  const myGames = games.filter(g => [...(g.team_a||[]),...(g.team_b||[])].includes(player.id)).slice(0,5);
  const form = myGames.map(g => {
    const inA = (g.team_a||[]).includes(player.id);
    return (inA && g.winner==="A") || (!inA && g.winner==="B") ? "W" : "L";
  });

  // 최고 득점
  const bestScoreGame = games.filter(g => g.player_scores?.[player.id]).sort((a,b) => (b.player_scores[player.id]||0)-(a.player_scores[player.id]||0))[0];
  const bestScore = bestScoreGame ? bestScoreGame.player_scores[player.id] : 0;

  // 평균 득점
  const scoredGames = games.filter(g => g.player_scores?.[player.id] !== undefined && [...(g.team_a||[]),...(g.team_b||[])].includes(player.id));
  const avgPts = scoredGames.length > 0
    ? (scoredGames.reduce((s,g) => s+(g.player_scores[player.id]||0),0)/scoredGames.length).toFixed(1)
    : null;

  // 베스트 파트너 / 천적
  const partnerStats: Record<string,{wins:number,games:number}> = {};
  const enemyStats: Record<string,{wins:number,games:number}> = {};
  games.forEach(g => {
    const inA = (g.team_a||[]).includes(player.id);
    const inB = (g.team_b||[]).includes(player.id);
    if (!inA && !inB) return;
    const myTeam = inA ? g.team_a : g.team_b;
    const oppTeam = inA ? g.team_b : g.team_a;
    const iWon = (inA && g.winner==="A")||(inB && g.winner==="B");
    myTeam.filter(id=>id!==player.id).forEach(id=>{
      if(!partnerStats[id]) partnerStats[id]={wins:0,games:0};
      partnerStats[id].games++; if(iWon) partnerStats[id].wins++;
    });
    oppTeam.forEach(id=>{
      if(!enemyStats[id]) enemyStats[id]={wins:0,games:0};
      enemyStats[id].games++; if(iWon) enemyStats[id].wins++;
    });
  });
  const bestPartner = Object.entries(partnerStats).filter(([,v])=>v.games>=2).sort((a,b)=>(b[1].wins/b[1].games)-(a[1].wins/a[1].games))[0];
  const nemesis = Object.entries(enemyStats).filter(([,v])=>v.games>=2).sort((a,b)=>(a[1].wins/a[1].games)-(b[1].wins/b[1].games))[0];
  const pname = (id: string) => players.find(p=>p.id===id)?.name ?? "?";

  // 1vs1 상대별 전적
  const myDuels = duels.filter(d => d.player_a===player.id || d.player_b===player.id);
  const duelMap: Record<string,{wins:number,losses:number}> = {};
  myDuels.forEach(d => {
    const oppId = d.player_a===player.id ? d.player_b : d.player_a;
    if(!duelMap[oppId]) duelMap[oppId]={wins:0,losses:0};
    if(d.winner===player.id) duelMap[oppId].wins++;
    else duelMap[oppId].losses++;
  });

  async function saveSig() {
    setSavingSig(true);
    await sb.patch("players",{signature:sig},`?id=eq.${player.id}`);
    setSavingSig(false); setEditSig(false); onReload();
  }

  return (
    <div style={S.page}>
      {/* 프로필 헤더 */}
      <div style={S.profileHero}>
        <div style={S.profileInfo}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
            <div style={S.profileName}>{player.name}</div>
            <TitleTag title={getTitle(player,games,players)}/>
          </div>
          {/* 시그니처 무브 */}
          <div style={{marginTop:8}}>
            {editSig ? (
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input style={{...S.input,fontSize:12,padding:"5px 8px"}} placeholder="ex. 페이드어웨이" value={sig} onChange={e=>setSig(e.target.value)} />
                <button style={{...S.btnPrimary,padding:"5px 10px",fontSize:12}} onClick={saveSig} disabled={savingSig}>{savingSig?"...":"저장"}</button>
                <button style={{...S.btnGhost,padding:"5px 8px",fontSize:12}} onClick={()=>setEditSig(false)}>취소</button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,color:player.signature?"#fff":"#555"}}>
                  {player.signature ? `✦ ${player.signature}` : "시그니처 무브 없음"}
                </span>
                <button style={{...S.iconBtn,fontSize:11,color:"#555"}} onClick={()=>setEditSig(true)}>수정</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 포지션 */}
      <div style={{borderBottom:"1px solid #262626",padding:"20px 16px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,fontWeight:700,color:"#555"}}>포지션</span>
        <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>
          {({PG:"포인트 가드",SG:"슈팅 가드",SF:"스몰 포워드",PF:"파워 포워드",C:"센터"} as Record<string,string>)[player.position]??player.position}
        </span>
      </div>

      {/* 핵심 스탯 */}
      <div style={S.statGrid}>
        <div style={S.statBox}>
          <span style={S.statBig}>{player.win_rate||0}%</span>
          <span style={S.statLabel}>승률</span>
        </div>
        <div style={S.statBox}>
          <span style={S.statBig}>{player.wins}W {player.losses}L</span>
          <span style={S.statLabel}>전적</span>
        </div>
        <div style={S.statBox}>
          <span style={S.statBig}>{player.mvp}</span>
          <span style={S.statLabel}>MVP</span>
        </div>
        <div style={S.statBox}>
          <span style={S.statBig}>{avgPts ?? "—"}</span>
          <span style={S.statLabel}>평균득점</span>
        </div>
      </div>

      {/* 승률 트렌드 */}
      {(()=>{
        const pg=[...games].filter(g=>[...(g.team_a||[]),...(g.team_b||[])].includes(player.id)).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
        if(pg.length<3) return null;
        let w=0;
        const trend=pg.map((g,i)=>{const inA=(g.team_a||[]).includes(player.id);if((inA&&g.winner==="A")||(!inA&&g.winner==="B"))w++;return Math.round(w/(i+1)*100);});
        const last=trend[trend.length-1];
        const prev=trend[trend.length-2];
        const diff=last-prev;
        return (
          <div style={{...S.card,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:1,marginBottom:4}}>WIN RATE TREND</div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:22,fontWeight:900,fontFamily:"'Bebas Neue',sans-serif",color:"#fff",lineHeight:1}}>{last}%</span>
                <span style={{fontSize:11,fontWeight:700,color:diff>0?"#22C55E":diff<0?"#ef4444":"#555"}}>{diff>0?`+${diff}`:diff}%</span>
              </div>
            </div>
            <Sparkline values={trend} color={tier?.color??"#555"}/>
          </div>
        );
      })()}

      {/* 최고 득점 */}
      {bestScore > 0 && (
        <div style={{...S.card,background:"rgba(255,98,0,0.08)",borderBottom:"1px solid rgba(255,98,0,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#FF6200",marginBottom:4}}>BEST GAME</div>
              <div style={{fontSize:36,fontWeight:900,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1}}>{bestScore} <span style={{fontSize:16,color:"#888"}}>pts</span></div>
              <div style={{fontSize:12,color:"#555",marginTop:4}}>
                {new Date(bestScoreGame!.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1vs1 전적 */}
      {Object.keys(duelMap).length > 0 && (
        <div style={S.card}>
          <div style={S.cardHeader}><span style={S.cardTitle}>1vs1 전적</span></div>
          {Object.entries(duelMap).sort((a,b)=>(b[1].wins+b[1].losses)-(a[1].wins+a[1].losses)).map(([oppId,stat])=>{
            const total = stat.wins+stat.losses;
            const wr = Math.round(stat.wins/total*100);
            return (
              <div key={oppId} style={{padding:"12px 0",borderBottom:"1px solid #1e1e1e"}}>
                <div style={{display:"flex",alignItems:"center"}}>
                  <span style={{flex:1,fontSize:14,fontWeight:700,color:"#fff"}}>{pname(oppId)}</span>
                  <span style={{fontSize:11,color:"#444",marginRight:10}}>{stat.wins}W {stat.losses}L</span>
                  <span style={{fontSize:22,fontWeight:900,fontFamily:"'Bebas Neue',sans-serif",color:"#fff",lineHeight:1}}>{wr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 티어 진행도 */}
      {totalGames >= 3 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <span style={S.cardTitle}>TIER PROGRESS</span>
              <div style={{marginTop:6}}>
                {tier ? <TierBadge tier={tier}/> : <span style={{fontSize:12,color:"#444"}}>언랭</span>}
              </div>
            </div>
            {nextTier
              ? <span style={{fontSize:12,color:"#555"}}>{nextTier.tier.name}까지 {nextTier.gap}점</span>
              : <span style={{fontSize:12,color:"#FF6200"}}>최고 Tier!</span>
            }
          </div>
          <div style={{height:6,background:"#1e1e1e",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(tierScore??0,100)}%`,background:tier?.color??"#FF6200",borderRadius:4,transition:"width .6s"}} />
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontSize:12,color:"#444"}}>0</span>
            <span style={{fontSize:12,fontWeight:700,color:"#888"}}>{tierScore}점</span>
            <span style={{fontSize:12,color:"#444"}}>100</span>
          </div>
        </div>
      )}

      {/* 최근 폼 */}
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>RECENT FORM</span></div>
        {form.length === 0 ? <Empty text="경기 기록 없음" /> : (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {form.map((r,i) => (
              <div key={i} style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",background:r==="W"?"#FF6200":"#161616",border:r==="W"?"none":"1px solid #2a2a2a",fontWeight:800,fontSize:13,color:r==="W"?"#fff":"#444"}}>{r==="W"?"승":"패"}</div>
            ))}
            {[...Array(Math.max(0,5-form.length))].map((_,i)=>(
              <div key={`e${i}`} style={{width:36,height:36,borderRadius:8,background:"#161616",border:"1px dashed #2a2a2a"}} />
            ))}
          </div>
        )}
      </div>

      {/* 베스트 파트너 / 천적 */}
      <div style={{...S.card,display:"flex",gap:10,padding:"20px 16px"}}>
        <div style={{flex:1,background:"#161616",borderRadius:10,overflow:"hidden",borderTop:"2px solid #22C55E50",padding:"14px"}}>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#22C55E"}}>깐부</span>
          {bestPartner ? (
            <div style={{marginTop:10}}>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:5}}>{pname(bestPartner[0])}</div>
              <div style={{fontSize:12,color:"#22C55E",fontWeight:600,marginBottom:3}}>같이 뛰면 {Math.round(bestPartner[1].wins/bestPartner[1].games*100)}%로 이깁니다</div>
              <div style={{fontSize:11,color:"#444"}}>{bestPartner[1].games}경기</div>
            </div>
          ) : <div style={{marginTop:10,fontSize:12,color:"#333"}}>데이터 부족</div>}
        </div>
        <div style={{flex:1,background:"#161616",borderRadius:10,overflow:"hidden",borderTop:"2px solid #ef444450",padding:"14px"}}>
          <span style={{fontSize:10,fontWeight:800,letterSpacing:1.5,color:"#dc2626"}}>담당일진</span>
          {nemesis ? (
            <div style={{marginTop:10}}>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:5}}>{pname(nemesis[0])}</div>
              <div style={{fontSize:12,color:"#dc2626",fontWeight:600,marginBottom:3}}>붙으면 {Math.round((1-nemesis[1].wins/nemesis[1].games)*100)}%로 죽습니다</div>
              <div style={{fontSize:11,color:"#444"}}>{nemesis[1].games}경기</div>
            </div>
          ) : <div style={{marginTop:10,fontSize:12,color:"#333"}}>데이터 부족</div>}
        </div>
      </div>

      {/* 최근 경기 */}
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>GAMES</span></div>
        {myGames.length===0 && <Empty text="경기 기록 없음" />}
        {myGames.map(g=>(
          <div key={g.id} style={S.gameWrap}>
            <GameCard game={g} players={players} highlightId={player.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function Home({ players, games, duels, onSelectPlayer, onGoToLog }: { players: Player[]; games: Game[]; duels: Duel[]; onSelectPlayer: (p:Player)=>void; onGoToLog: ()=>void }) {
  const sorted = [...players].sort((a,b)=>(b.win_rate||0)-(a.win_rate||0));
  const mvpSorted = [...players].sort((a,b)=>(b.mvp||0)-(a.mvp||0));
  const duelSorted = [...players].filter(p=>(p.duel_wins||0)+(p.duel_losses||0)>0).sort((a,b)=>{
    const aTotal=(a.duel_wins||0)+(a.duel_losses||0);
    const bTotal=(b.duel_wins||0)+(b.duel_losses||0);
    const aWr=aTotal>0?(a.duel_wins||0)/aTotal:0;
    const bWr=bTotal>0?(b.duel_wins||0)/bTotal:0;
    return bWr-aWr;
  });
  const hotPlayers = players.filter(p=>{
    const myGames=games.filter(g=>[...(g.team_a||[]),...(g.team_b||[])].includes(p.id)).slice(0,3);
    if(myGames.length<3) return false;
    return myGames.every(g=>{const inA=(g.team_a||[]).includes(p.id);return(inA&&g.winner==="A")||(!inA&&g.winner==="B");});
  });
  const lastGame=games[0];

  return (
    <div style={S.page}>
      <div style={S.summaryRow}>
        <div style={S.summaryCard}>
          <span style={S.summaryNum}>{games.length}</span>
          <span style={S.summaryLabel}>GAMES</span>
        </div>
        <div style={S.summaryDivider}/>
        <div style={S.summaryCard}>
          <span style={S.summaryNum}>{duels.length}</span>
          <span style={S.summaryLabel}>1vs1</span>
        </div>
        <div style={S.summaryDivider}/>
        <div style={S.summaryCard}>
          <span style={{...S.summaryNum,fontSize:15,cursor:"pointer"}} onClick={()=>mvpSorted[0]&&onSelectPlayer(mvpSorted[0])}>
            {mvpSorted[0]?.name??"—"}
          </span>
          <span style={{...S.summaryLabel,display:"flex",alignItems:"center",gap:3}}><img src="/crown.png" style={{width:13,height:13}}/>MVP</span>
        </div>
      </div>

      {hotPlayers.length>0&&(
        <div style={{...S.card,borderLeft:"3px solid #FF6200"}}>
          <div style={S.cardHeader}>
            <span style={{...S.cardTitle,color:"#FF6200"}}>요즘 핫함</span>
            <span style={{fontSize:11,color:"#555"}}>최근 3연승</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {hotPlayers.map((p,i)=>{
              const streak=getStreak(p.id,games);
              const tier=getTier(p);
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",padding:"10px 0",borderTop:i===0?"none":"1px solid #1e1e1e",cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{p.name}</span>
                      {tier&&<TierBadge tier={tier}/>}
                    </div>
                    <span style={{fontSize:11,color:"#FF620099"}}>{streak?`${streak.count}연승 진행 중 · 승률 ${p.win_rate}%`:`승률 ${p.win_rate}%`}</span>
                  </div>
                  <span style={{fontSize:12,color:"#333"}}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>RANKING</span>
          <span style={S.cardSub}>승률 기준</span>
        </div>
        {sorted.length===0&&<Empty text="선수를 추가하세요"/>}
        {sorted.map((p,i)=>{
          const tier=getTier(p);
          return (
            <div key={p.id} style={{...S.rankRow,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
              <span style={{...S.rankIdx,color:i<3?"#FF6200":"#555"}}>{i+1}</span>
              <div style={S.rankInfo}>
                <div style={{...S.rankTop,justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={S.rankName}>{p.name}</span>
                    <PosTag pos={p.position}/>
                  </div>
                  {tier&&<TierBadge tier={tier}/>}
                </div>
                <div style={S.rankBar}><div style={{...S.rankFill,width:`${p.win_rate||0}%`,background:i===0?"#FF6200":"#2a2a2a"}}/></div>
              </div>
              <div style={S.rankStat}>
                <span style={S.rankRate}>{p.win_rate||0}%</span>
                <span style={S.rankRecord}>{p.wins}W {p.losses}L</span>
              </div>
              <span style={{fontSize:12,color:"#444"}}>›</span>
            </div>
          );
        })}
      </div>

      {duelSorted.length>0&&(
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>1vs1 RANKING</span>
            <span style={S.cardSub}>승률 기준</span>
          </div>
          {duelSorted.map((p,i)=>{
            const total=(p.duel_wins||0)+(p.duel_losses||0);
            const wr=total>0?Math.round((p.duel_wins||0)/total*100):0;
            return (
              <div key={p.id} style={{...S.rankRow,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
                <span style={{...S.rankIdx,color:i<3?"#FF6200":"#555"}}>{i+1}</span>
                <div style={S.rankInfo}>
                  <div style={S.rankTop}><span style={S.rankName}>{p.name}</span><PosTag pos={p.position}/></div>
                  <div style={S.rankBar}><div style={{...S.rankFill,width:`${wr}%`,background:i===0?"#FF6200":"#2a2a2a"}}/></div>
                </div>
                <div style={S.rankStat}>
                  <span style={S.rankRate}>{wr}%</span>
                  <span style={S.rankRecord}>{p.duel_wins||0}W {p.duel_losses||0}L</span>
                </div>
                <span style={{fontSize:12,color:"#444"}}>›</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>MVP RANKING</span>
          <span style={S.cardSub}>누적</span>
        </div>
        {mvpSorted.filter(p=>p.mvp>0).length===0&&<Empty text="MVP 기록 없음"/>}
        {mvpSorted.filter(p=>p.mvp>0).map((p,i)=>{
          return (
          <div key={p.id} style={{...S.rankRow,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
            <span style={{...S.rankIdx,color:i===0?"#FF6200":i===1?"#888":i===2?"#666":"#555"}}>{i+1}</span>
            <div style={S.rankInfo}>
              <div style={S.rankTop}><span style={S.rankName}>{p.name}</span><PosTag pos={p.position}/></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <img src="/crown.png" style={{width:13,height:13,verticalAlign:"middle"}}/>
              <span style={{fontSize:12,fontWeight:700,color:"#FF6200",fontFamily:"'Noto Sans KR',sans-serif"}}>MVP</span>
              <span style={{...S.rankRate,color:"#FF6200"}}>{p.mvp}</span>
            </div>
            <span style={{fontSize:12,color:"#444"}}>›</span>
          </div>
          );
        })}
      </div>

      {lastGame&&(
        <div style={S.card}>
          <div style={S.cardHeader}><span style={S.cardTitle}>LAST GAME</span></div>
          <GameCard game={lastGame} players={players}/>
        </div>
      )}

      {players.length>0&&games.length>0&&(()=>{
        const bestWin=players.map(p=>({p,n:getAllTimeMaxStreak(p.id,games,"W")})).sort((a,b)=>b.n-a.n)[0];
        const worstLoss=players.map(p=>({p,n:getAllTimeMaxStreak(p.id,games,"L")})).sort((a,b)=>b.n-a.n)[0];
        const blowout=[...games].sort((a,b)=>Math.abs(b.score_a-b.score_b)-Math.abs(a.score_a-a.score_b))[0];
        const blowoutDiff=blowout?Math.abs(blowout.score_a-blowout.score_b):0;
        const ironMan=[...players].sort((a,b)=>(b.wins+b.losses)-(a.wins+a.losses))[0];
        const topWr=players.filter(p=>p.wins+p.losses>=5).sort((a,b)=>(b.win_rate??0)-(a.win_rate??0))[0];
        const bottomWr=players.filter(p=>p.wins+p.losses>=5).sort((a,b)=>(a.win_rate??0)-(b.win_rate??0))[0];
        const teamHighScore=games.length>0?Math.max(...games.flatMap(g=>[g.score_a,g.score_b])):0;
        const rows:[{label:string;name:string|null|undefined;stat:string|null;color:string;onClick?:()=>void}]=[
          {label:"역대 최장 연승", name:bestWin?.p.name,   stat:`${bestWin?.n}연승`,                             color:"#F59E0B", onClick:bestWin?.p?()=>onSelectPlayer(bestWin.p):undefined},
          {label:"역대 최장 연패", name:worstLoss?.p.name, stat:`${worstLoss?.n}연패`,                           color:"#475569", onClick:worstLoss?.p?()=>onSelectPlayer(worstLoss.p):undefined},
          {label:"역대 최고 승률", name:topWr?.name,       stat:topWr?`${topWr.win_rate}%`:null,                 color:"#FF6200", onClick:topWr?()=>onSelectPlayer(topWr):undefined},
          {label:"역대 최저 승률", name:bottomWr?.name,    stat:bottomWr?`${bottomWr.win_rate}%`:null,           color:"#475569", onClick:bottomWr?()=>onSelectPlayer(bottomWr):undefined},
          {label:"최다 경기 출전", name:ironMan?.name,     stat:`${(ironMan?.wins??0)+(ironMan?.losses??0)}경기`, color:"#60A5FA", onClick:ironMan?()=>onSelectPlayer(ironMan):undefined},
          {label:"팀 최고 스코어", name:null,              stat:teamHighScore?`${teamHighScore}점`:null,          color:"#60A5FA", onClick:onGoToLog},
          {label:"최대 점수 차",   name:blowout?`${blowout.score_a} - ${blowout.score_b}`:null, stat:blowoutDiff?`${blowoutDiff}점 차`:null, color:"#555", onClick:onGoToLog},
        ] as any;
        return (
          <div style={S.card}>
            <div style={S.cardHeader}><span style={S.cardTitle}>통산 기록</span></div>
            {rows.filter((r:any)=>r.stat).map((r:any,i:number)=>(
              <div key={i} onClick={r.onClick} style={{display:"flex",alignItems:"center",paddingTop:i===0?0:12,marginTop:i===0?0:12,borderTop:i===0?"none":"1px solid #1e1e1e",cursor:r.onClick?"pointer":"default"}}>
                <span style={{flex:1,fontSize:13,color:"#555",fontWeight:600}}>{r.label}</span>
                {r.name&&<span style={{fontSize:13,fontWeight:700,color:"#888",marginRight:10}}>{r.name}</span>}
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:18,fontWeight:900,fontFamily:"'Bebas Neue',sans-serif",color:r.color,lineHeight:1}}>{r.stat}</span>
                  {r.onClick&&<span style={{fontSize:12,color:"#333"}}>›</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── PLAYERS ───────────────────────────────────────────────────────────────────
function Players({ players, games, onReload, onSelectPlayer }: { players: Player[]; games: Game[]; onReload: () => void; onSelectPlayer: (p:Player)=>void }) {
  const [name, setName] = useState("");
  const [pos, setPos] = useState("PG");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{id:string;name:string;position:string}|null>(null);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await sb.post("players",{id:uid(),name:name.trim(),position:pos,wins:0,losses:0,mvp:0,win_rate:0,avg_points:0,signature:"",best_score:0,duel_wins:0,duel_losses:0});
      setName(""); onReload();
    } finally { setSaving(false); }
  }
  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    await sb.del("players",`?id=eq.${id}`); onReload();
  }
  async function saveEdit() {
    if (!editing) return;
    await sb.patch("players",{name:editing.name,position:editing.position},`?id=eq.${editing.id}`);
    setEditing(null); onReload();
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>ADD PLAYER</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",gap:8}}>
            <input style={S.input} placeholder="이름 입력" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
            <select style={S.select} value={pos} onChange={e=>setPos(e.target.value)}>
              {POSITIONS.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <button style={{...S.btnPrimary,opacity:saving?.5:1,width:"100%"}} onClick={add} disabled={saving}>{saving?"...":"추가"}</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>PLAYERS</span>
          <span style={S.cardSub}>{players.length}명</span>
        </div>
        {players.length===0&&<Empty text="선수가 없습니다"/>}
        {players.map(p=>{
          const tier=getTier(p);
          const streak=getStreak(p.id,games);
          const title=getTitle(p,games,players);
          return (
            <div key={p.id} style={{...S.playerRow,flexDirection:"column",alignItems:"stretch",gap:0}}>
              <div style={{display:"flex",alignItems:"center"}}>
                <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:16,fontWeight:700,color:"#fff"}}>{p.name}</span>
                    <PosTag pos={p.position}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={S.rankRecord}>{p.wins}W {p.losses}L</span>
                    {streak&&<span style={{fontSize:11,fontWeight:600,color:"#444"}}>{streak.count}{streak.type==="W"?"연승":"연패"}</span>}
                    <TitleTag title={title}/>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  {tier&&<TierBadge tier={tier}/>}
                  <span style={{fontSize:22,fontWeight:900,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1}}>{p.win_rate||0}%</span>
                  <button style={{background:"none",border:"none",color:"#333",fontSize:18,cursor:"pointer",padding:"0 4px",lineHeight:1,letterSpacing:1}} onClick={e=>{e.stopPropagation();setEditing(editing?.id===p.id?null:{id:p.id,name:p.name,position:p.position})}}>···</button>
                </div>
              </div>
              {editing?.id===p.id&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e1e1e",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:8}}>
                    <input style={{...S.input,flex:1}} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>
                    <select style={S.select} value={editing.position} onChange={e=>setEditing({...editing,position:e.target.value})}>
                      {POSITIONS.map(pos=><option key={pos}>{pos}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...S.btnPrimary,flex:1}} onClick={saveEdit}>저장</button>
                    <button style={{...S.btnGhost,flex:1,color:"#ef4444",borderColor:"#333"}} onClick={()=>del(p.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RECORD GAME ───────────────────────────────────────────────────────────────
function RecordGame({ players, onReload }: { players: Player[]; onReload: () => void }) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [guestsA, setGuestsA] = useState<string[]>([]);
  const [guestsB, setGuestsB] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [guestTeam, setGuestTeam] = useState<"A"|"B">("A");
  const winner = Number(scoreA) >= Number(scoreB) ? "A" : "B";
  const [mvp, setMvp] = useState("");
  const [playerScores, setPlayerScores] = useState<Record<string,string>>({});
  const [showScores, setShowScores] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const inTeam=[...teamA,...teamB];
  const free=players.filter(p=>!inTeam.includes(p.id));
  const allTeamPlayers=inTeam.map(id=>players.find(p=>p.id===id)).filter(Boolean) as Player[];
  const modeLabel = () => {
    const aCount=teamA.length+guestsA.length;
    const bCount=teamB.length+guestsB.length;
    if(aCount===0||bCount===0) return "";
    return `${aCount}vs${bCount}`;
  };

  function toggleTeam(team:"A"|"B",id:string) {
    if(team==="A") setTeamA(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
    else setTeamB(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }
  function addGuest() {
    if(!guestInput.trim()) return;
    if(guestTeam==="A") setGuestsA(prev=>[...prev,guestInput.trim()]);
    else setGuestsB(prev=>[...prev,guestInput.trim()]);
    setGuestInput("");
  }

  async function submit() {
    if(!scoreA||!scoreB) return setErr("스코어를 입력하세요");
    if(teamA.length+guestsA.length<1||teamB.length+guestsB.length<1) return setErr("각 팀 최소 1명");
    setErr(""); setSaving(true);
    try {
      const scores:Record<string,number>={};
      Object.entries(playerScores).forEach(([k,v])=>{if(v) scores[k]=Number(v);});
      await sb.post("games",{id:uid(),score_a:Number(scoreA),score_b:Number(scoreB),team_a:teamA,team_b:teamB,winner,mvp:mvp||null,player_scores:scores});
      const winTeam=winner==="A"?teamA:teamB;
      const loseTeam=winner==="A"?teamB:teamA;
      const allGames=await sb.get("games","?order=created_at.desc");
      await Promise.all(players.map(async p=>{
        const isWin=winTeam.includes(p.id);
        const isLose=loseTeam.includes(p.id);
        if(!isWin&&!isLose&&mvp!==p.id) return;
        const nw=p.wins+(isWin?1:0);
        const nl=p.losses+(isLose?1:0);
        const nm=p.mvp+(mvp===p.id?1:0);
        const nr=nw+nl>0?Math.round((nw/(nw+nl))*100):0;
        const pg=(allGames||[]).filter((g:Game)=>[...(g.team_a||[]),...(g.team_b||[])].includes(p.id));
        const scoredG=pg.filter((g:Game)=>g.player_scores&&g.player_scores[p.id]!==undefined);
        const newAvg=scoredG.length>0?scoredG.reduce((s:number,g:Game)=>s+(g.player_scores[p.id]||0),0)/scoredG.length:p.avg_points||0;
        const allScores=pg.map((g:Game)=>g.player_scores?.[p.id]||0).filter((s:number)=>s>0);
        const newBest=allScores.length>0?Math.max(...allScores):p.best_score||0;
        await sb.patch("players",{wins:nw,losses:nl,mvp:nm,win_rate:nr,avg_points:Math.round(newAvg*10)/10,best_score:newBest},`?id=eq.${p.id}`);
      }));
      setDone(true);
      setTimeout(()=>{setDone(false);setScoreA("");setScoreB("");setTeamA([]);setTeamB([]);setGuestsA([]);setGuestsB([]);setMvp("");setPlayerScores({});onReload();},1500);
    } catch(e:any){setErr(e.message);}
    finally{setSaving(false);}
  }

  if(done) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:12}}>
      <span style={{fontSize:18,fontWeight:700,color:"#FF6200",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2}}>SAVED</span>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>SCORE</span>
          {modeLabel()&&<span style={{fontSize:13,fontWeight:800,color:"#111",background:"#f1f5f9",padding:"3px 10px",borderRadius:20}}>{modeLabel()}</span>}
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:6}}>
          <div style={{width:72,textAlign:"center"}}><span style={S.scoreLabel}>TEAM A</span></div>
          <div style={{width:32}}/>
          <div style={{width:72,textAlign:"center"}}><span style={S.scoreLabel}>TEAM B</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
          <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreA} onChange={e=>setScoreA(e.target.value)}/>
          <span style={{fontSize:28,color:"#fff",fontWeight:900,fontFamily:"'Bebas Neue',sans-serif",lineHeight:1,width:32,textAlign:"center"}}>VS</span>
          <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreB} onChange={e=>setScoreB(e.target.value)}/>
        </div>
      </div>

      <div style={S.card}>
        <div style={{display:"flex",gap:10,marginTop:6}}>
          {(["A","B"] as const).map(t=>{
            const myTeam=t==="A"?teamA:teamB;
            const myGuests=t==="A"?guestsA:guestsB;
            const accent=t==="A"?"#FF6200":"#3b82f6";
            const total=myTeam.length+myGuests.length;
            return (
              <div key={t} style={{flex:1,minWidth:0,borderRadius:10,border:`1px solid ${accent}80`,overflow:"hidden"}}>
                {/* 팀 헤더 */}
                <div style={{background:accent+"bb",padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,fontWeight:800,color:"#fff",fontFamily:"'Noto Sans KR',sans-serif",letterSpacing:0}}>TEAM {t}</span>
                  {total>0&&<span style={{fontSize:13,fontWeight:800,color:"#fff",fontFamily:"'Noto Sans KR',sans-serif"}}>{total}</span>}
                </div>
                {/* 등록 멤버 */}
                <div style={{padding:"6px 10px",background:"#111"}}>
                  {myTeam.map(id=>{const p=players.find(x=>x.id===id);return p?(
                    <div key={id} style={{display:"flex",alignItems:"center",gap:4,padding:"9px 0",borderBottom:"1px solid #1e1e1e"}}>
                      <span style={{fontSize:13,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      <PosTag pos={p.position}/>
                      <span style={{flex:1}}/>
                      <button style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 2px",lineHeight:1,flexShrink:0}} onClick={()=>toggleTeam(t,id)}>×</button>
                    </div>
                  ):null;})}
                  {myGuests.map((gname,i)=>(
                    <div key={`g${i}`} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 0",borderBottom:"1px solid #1e1e1e"}}>
                      <span style={{fontSize:10,padding:"2px 5px",borderRadius:3,background:"transparent",color:"#555",border:"1px solid #333",fontWeight:700,flexShrink:0}}>GUEST</span>
                      <span style={{flex:1,fontSize:13,color:"#888",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{gname}</span>
                      <button style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 2px",lineHeight:1}} onClick={()=>{
                        if(t==="A") setGuestsA(prev=>prev.filter((_,idx)=>idx!==i));
                        else setGuestsB(prev=>prev.filter((_,idx)=>idx!==i));
                      }}>×</button>
                    </div>
                  ))}
                  {/* 추가 가능 선수 */}
                  {free.length>0&&<div style={{marginTop:4}}>
                    {free.map(p=>(
                      <button key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 0",width:"100%",background:"transparent",border:"none",cursor:"pointer",borderBottom:"1px solid #1a1a1a"}} onClick={()=>toggleTeam(t,p.id)}>
                        <span style={{fontSize:12,color:"#999"}}>{p.name}</span>
                        <PosTag pos={p.position}/>
                        <span style={{flex:1}}/>
                        <span style={{color:accent,fontWeight:800,fontSize:16,lineHeight:1,flexShrink:0}}>+</span>
                      </button>
                    ))}
                  </div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 게스트 추가 */}
        <div style={{borderTop:"1px solid #262626",marginTop:14,paddingTop:12}}>
          <div style={S.fieldLabel}>게스트 추가</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:6}}>
              <input style={{...S.input,flex:1}} placeholder="게스트 이름" value={guestInput} onChange={e=>setGuestInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGuest()}/>
              <select style={S.select} value={guestTeam} onChange={e=>setGuestTeam(e.target.value as "A"|"B")}>
                <option value="A">팀 A</option>
                <option value="B">팀 B</option>
              </select>
            </div>
            <button style={{...S.btnPrimary,width:"100%"}} onClick={addGuest}>추가</button>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>RESULT</span></div>
        {scoreA&&scoreB&&<div style={{marginBottom:14,padding:"8px 12px",background:"rgba(255,98,0,0.08)",borderRadius:8,fontSize:12,color:"#FF6200",fontWeight:700}}>
          TEAM {winner} WIN ({Number(scoreA) > Number(scoreB) ? `${scoreA} : ${scoreB}` : `${scoreB} : ${scoreA}`})
        </div>}
        <div style={{marginBottom:14}}>
          <div style={S.fieldLabel}>MVP (선택)</div>
          <select style={{...S.select,width:"100%"}} value={mvp} onChange={e=>setMvp(e.target.value)}>
            <option value="">없음</option>
            {allTeamPlayers.map(p=><option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
          </select>
        </div>
        <div>
          <button style={{...S.btnGhost,width:"100%",marginBottom:8}} onClick={()=>setShowScores(!showScores)}>
            {showScores?"▲":"▼"} 개인 득점 입력 (선택)
          </button>
          {showScores&&(
            <div style={S.scoresBox}>
              {allTeamPlayers.map(p=>(
                <div key={p.id} style={S.scoreItemRow}>
                  <PosTag pos={p.position}/>
                  <span style={{flex:1,fontSize:13,fontWeight:500,color:teamA.includes(p.id)?"#2563eb":"#dc2626"}}>{p.name}</span>
                  <input style={{...S.input,width:56,textAlign:"center",padding:"5px"}} type="number" min="0" placeholder="0"
                    value={playerScores[p.id]||""} onChange={e=>setPlayerScores(prev=>({...prev,[p.id]:e.target.value}))}/>
                  <span style={{fontSize:12,color:"#6b7280"}}>pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {err&&<p style={{color:"#dc2626",fontSize:12,marginTop:8}}>{err}</p>}
        <button style={{...S.btnPrimary,width:"100%",padding:"16px 0",marginTop:12,fontSize:16,opacity:saving?.6:1}} onClick={submit} disabled={saving}>
          {saving?"저장 중...":"경기 저장"}
        </button>
      </div>
    </div>
  );
}

// ── DUEL TAB ──────────────────────────────────────────────────────────────────
function DuelTab({ players, duels, onReload, onSelectPlayer }: { players: Player[]; duels: Duel[]; onReload: () => void; onSelectPlayer: (p:Player)=>void }) {
  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const [sA, setSA] = useState("");
  const [sB, setSB] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if(!pA||!pB) return setErr("두 선수를 선택하세요");
    if(pA===pB) return setErr("같은 선수를 선택할 수 없어요");
    if(!sA||!sB) return setErr("스코어를 입력하세요");
    setErr(""); setSaving(true);
    try {
      const winnerId = Number(sA)>Number(sB)?pA:pB;
      await sb.post("duels",{id:uid(),player_a:pA,player_b:pB,score_a:Number(sA),score_b:Number(sB),winner:winnerId});
      const playerAData=players.find(p=>p.id===pA)!;
      const playerBData=players.find(p=>p.id===pB)!;
      const aWon=Number(sA)>Number(sB);
      await sb.patch("players",{duel_wins:(playerAData.duel_wins||0)+(aWon?1:0),duel_losses:(playerAData.duel_losses||0)+(aWon?0:1)},`?id=eq.${pA}`);
      await sb.patch("players",{duel_wins:(playerBData.duel_wins||0)+(aWon?0:1),duel_losses:(playerBData.duel_losses||0)+(aWon?1:0)},`?id=eq.${pB}`);
      setDone(true);
      setTimeout(()=>{setDone(false);setPA("");setPB("");setSA("");setSB("");onReload();},1500);
    } catch(e:any){setErr(e.message);}
    finally{setSaving(false);}
  }

  const pname=(id:string)=>players.find(p=>p.id===id)?.name??"?";

  if(done) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:12}}>
      <span style={{fontSize:18,fontWeight:700,color:"#FF6200",fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2}}>SAVED</span>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>1vs1 기록</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <select style={{...S.select,flex:1}} value={pA} onChange={e=>setPA(e.target.value)}>
            <option value="">선수 선택</option>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{color:"#555",fontWeight:700,fontSize:14}}>vs</span>
          <select style={{...S.select,flex:1}} value={pB} onChange={e=>setPB(e.target.value)}>
            <option value="">선수 선택</option>
            {players.filter(p=>p.id!==pA).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={S.scoreRow}>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>{pA?pname(pA):"선수 A"}</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={sA} onChange={e=>setSA(e.target.value)}/>
          </div>
          <span style={S.scoreVs}>:</span>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>{pB?pname(pB):"선수 B"}</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={sB} onChange={e=>setSB(e.target.value)}/>
          </div>
        </div>
        {err&&<p style={{color:"#dc2626",fontSize:12,margin:"8px 0"}}>{err}</p>}
        <button style={{...S.btnPrimary,width:"100%",padding:"16px 0",marginTop:12,fontSize:16,opacity:saving?.6:1}} onClick={submit} disabled={saving}>
          {saving?"저장 중...":"결과 저장"}
        </button>
      </div>

      {(()=>{
        const grouped=duels.reduce((acc,d)=>{
          const dt=new Date(d.created_at);
          const key=`${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
          if(!acc[key])acc[key]=[];acc[key].push(d);return acc;
        },{} as Record<string,Duel[]>);
        const keys=Object.keys(grouped).sort((a,b)=>b>a?1:-1);
        if(keys.length===0) return <div style={S.card}><Empty text="1vs1 기록이 없습니다"/></div>;
        return keys.map(date=>(
          <div key={date} style={S.card}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:1,marginBottom:10}}>{date}</div>
            {grouped[date].map(d=>{
              const aWon=d.winner===d.player_a;
              const doDelete=async()=>{
                if(!confirm("이 1vs1 기록을 삭제할까요?")) return;
                await sb.del("duels",`?id=eq.${d.id}`);
                const remaining=duels.filter(x=>x.id!==d.id);
                for(const pid of [d.player_a,d.player_b]){
                  const p=players.find(x=>x.id===pid);if(!p)continue;
                  const myD=remaining.filter(x=>x.player_a===pid||x.player_b===pid);
                  await sb.patch("players",{duel_wins:myD.filter(x=>x.winner===pid).length,duel_losses:myD.length-myD.filter(x=>x.winner===pid).length},`?id=eq.${pid}`);
                }
                onReload();
              };
              return (
                <div key={d.id} style={{...S.gameWrap,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{flex:1,fontSize:14,fontWeight:aWon?700:400,color:aWon?"#fff":"#555",cursor:"pointer",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={()=>{const p=players.find(x=>x.id===d.player_a);if(p)onSelectPlayer(p);}}>{pname(d.player_a)}</span>
                  <span style={{fontSize:22,fontWeight:900,color:aWon?"#fff":"#555",fontFamily:"'Bebas Neue',sans-serif",flexShrink:0}}>{d.score_a}</span>
                  <span style={{fontSize:12,color:"#333",flexShrink:0}}>:</span>
                  <span style={{fontSize:22,fontWeight:900,color:!aWon?"#fff":"#555",fontFamily:"'Bebas Neue',sans-serif",flexShrink:0}}>{d.score_b}</span>
                  <span style={{flex:1,fontSize:14,fontWeight:!aWon?700:400,color:!aWon?"#fff":"#555",textAlign:"right",cursor:"pointer",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={()=>{const p=players.find(x=>x.id===d.player_b);if(p)onSelectPlayer(p);}}>{pname(d.player_b)}</span>
                  <button style={{...S.delIcon,flexShrink:0}} onClick={doDelete}>×</button>
                </div>
              );
            })}
          </div>
        ));
      })()}
    </div>
  );
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function Log({ games, players, onReload }: { games: Game[]; players: Player[]; onReload: () => void }) {
  const [recalcing, setRecalcing] = useState(false);
  const [recalcDone, setRecalcDone] = useState(false);

  async function del(id:string) {
    if(!confirm("삭제할까요?")) return;
    await sb.del("games",`?id=eq.${id}`); onReload();
  }

  async function recalcAll() {
    if(!confirm("모든 선수 스탯을 경기 기록 기준으로 재계산할까요?")) return;
    setRecalcing(true);
    try {
      await Promise.all(players.map(async p => {
        const myGames = games.filter(g => [...(g.team_a||[]),...(g.team_b||[])].includes(p.id));
        let wins=0, losses=0, mvpCount=0;
        myGames.forEach(g => {
          const inA=(g.team_a||[]).includes(p.id);
          const won=(inA&&g.winner==="A")||(!inA&&g.winner==="B");
          if(won) wins++; else losses++;
          if(g.mvp===p.id) mvpCount++;
        });
        const total=wins+losses;
        const wr=total>0?Math.round((wins/total)*100):0;
        const scoredG=myGames.filter(g=>g.player_scores?.[p.id]!==undefined);
        const avgPts=scoredG.length>0?Math.round(scoredG.reduce((s,g)=>s+(g.player_scores[p.id]||0),0)/scoredG.length*10)/10:0;
        const allScores=myGames.map(g=>g.player_scores?.[p.id]||0).filter((s:number)=>s>0);
        const bestScore=allScores.length>0?Math.max(...allScores):0;
        await sb.patch("players",{wins,losses,mvp:mvpCount,win_rate:wr,avg_points:avgPts,best_score:bestScore},`?id=eq.${p.id}`);
      }));
      setRecalcDone(true);
      setTimeout(()=>{ setRecalcDone(false); onReload(); }, 1500);
    } finally { setRecalcing(false); }
  }

  return (
    <div style={S.page}>
      <div style={{...S.card, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>스탯 재계산</div>
          <div style={{fontSize:12,color:"#555",marginTop:2}}>경기 삭제 후 스탯이 안 맞을 때</div>
        </div>
        <button style={{...S.btnPrimary, opacity:recalcing?0.6:1, background:recalcDone?"#16a34a":"#FF6200"}} onClick={recalcAll} disabled={recalcing}>
          {recalcDone?"완료":recalcing?"계산 중...":"재계산"}
        </button>
      </div>
      {games.length===0&&<Empty text="경기 기록이 없습니다"/>}
      {(()=>{
        const grouped=games.reduce((acc,g)=>{
          const dt=new Date(g.created_at);
          const key=`${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
          if(!acc[key])acc[key]=[];acc[key].push(g);return acc;
        },{} as Record<string,Game[]>);
        const keys=Object.keys(grouped).sort((a,b)=>b>a?1:-1);
        return keys.map(date=>(
          <div key={date} style={S.card}>
            <div style={{fontSize:11,fontWeight:700,color:"#555",letterSpacing:1,marginBottom:10}}>{date}</div>
            {grouped[date].map(g=>(
              <div key={g.id} style={S.gameWrap}>
                <GameCard game={g} players={players} onDelete={()=>del(g.id)}/>
              </div>
            ))}
          </div>
        ));
      })()}
    </div>
  );
}

// ── GAME CARD ─────────────────────────────────────────────────────────────────
function GameCard({ game, players, highlightId, onDelete }: { game: Game; players: Player[]; highlightId?: string; onDelete?: () => void }) {
  const pname=(id:string)=>players.find(p=>p.id===id)?.name??id.slice(0,4);
  const modeA=(game.team_a||[]).length;
  const modeB=(game.team_b||[]).length;
  return (
    <div style={S.gcWrap}>
      <div style={{...S.gcMeta,position:"relative",justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:600,color:"#888",letterSpacing:0.5}}>{modeA}v{modeB}</span>
        </div>
        {onDelete&&<button style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#333",cursor:"pointer",fontSize:15,fontWeight:700,padding:0,lineHeight:1}} onClick={onDelete}>×</button>}
      </div>
      <div style={S.gcScore}>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{...S.gcTeamLabel,color:game.winner==="A"?"#FF6200":"#555"}}>TEAM A {game.winner==="A"?"WIN":""}</div>
          <div style={{...S.gcBigScore,color:game.winner==="A"?"#fff":"#333"}}>{game.score_a}</div>
          <div style={S.gcNames}>{(game.team_a||[]).map(id=><span key={id} style={{fontWeight:id===game.mvp||highlightId===id?700:400,color:id===game.mvp?"#F59E0B":game.winner==="A"?"#fff":"#555"}}>{pname(id)}</span>).reduce((a:any,b:any,i)=>[...a,<span key={i} style={{color:"#2a2a2a"}}> · </span>,b],[])}</div>
        </div>
        <div style={S.gcVs}>:</div>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{...S.gcTeamLabel,color:game.winner==="B"?"#FF6200":"#555"}}>TEAM B {game.winner==="B"?"WIN":""}</div>
          <div style={{...S.gcBigScore,color:game.winner==="B"?"#fff":"#333"}}>{game.score_b}</div>
          <div style={S.gcNames}>{(game.team_b||[]).map(id=><span key={id} style={{fontWeight:id===game.mvp||highlightId===id?700:400,color:id===game.mvp?"#F59E0B":game.winner==="B"?"#fff":"#555"}}>{pname(id)}</span>).reduce((a:any,b:any,i)=>[...a,<span key={i} style={{color:"#2a2a2a"}}> · </span>,b],[])}</div>
        </div>
      </div>
    </div>
  );
}

function GlobalStyle() {
  return <style>{`
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#0d0d0d;}
    input,select,button{font-family:inherit;}
    input:focus,select:focus{outline:none;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    button:active{opacity:0.7;}
  `}</style>;
}
function TierBadge({tier}:{tier:{name:string,color:string}}) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,flexShrink:0}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
        <span style={{fontSize:19,fontWeight:900,color:tier.color,fontFamily:"'Bebas Neue',sans-serif",lineHeight:1}}>{tier.name}</span>
        <span style={{display:"inline-block",width:22,height:22,background:tier.color,WebkitMaskImage:"url('/wing.png')",WebkitMaskSize:"contain",WebkitMaskRepeat:"no-repeat",WebkitMaskPosition:"center",maskImage:"url('/wing.png')",maskSize:"contain",maskRepeat:"no-repeat",maskPosition:"center"}}/>
      </span>
    </span>
  );
}
function TitleTag({title}:{title:{label:string;color:string}}) {
  return <span style={{fontSize:11,fontWeight:600,color:title.color,fontStyle:"italic"}}>"{title.label}"</span>;
}

function PosTag({pos}:{pos:string}) {
  return <span style={{fontSize:11,fontWeight:700,color:"#666",letterSpacing:0.3,border:"1px solid #2a2a2a",borderRadius:4,padding:"1px 5px",flexShrink:0}}>{pos}</span>;
}
function Empty({text}:{text:string}) {
  return <div style={{textAlign:"center",padding:"24px 0",color:"#444",fontSize:13}}>— {text} —</div>;
}

// BG:#0d0d0d  SURFACE:#161616  BORDER:#262626  TEXT:#fff  MUTED:#555  BRAND:#FF6200
const S:Record<string,React.CSSProperties>={
  root:         {minHeight:"100vh",background:"#0d0d0d",fontFamily:"'Noto Sans KR',sans-serif",color:"#fff"},
  loadWrap:     {display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0d0d0d",gap:8},
  loadText:     {fontSize:12,fontWeight:700,letterSpacing:3,color:"#555",fontFamily:"'Noto Sans KR',sans-serif"},
  header:       {background:"#0d0d0d",borderBottom:"1px solid #262626",padding:"0 16px",position:"sticky",top:0,zIndex:10},
  headerInner:  {display:"flex",alignItems:"center",justifyContent:"space-between",height:52},
  logo:         {display:"flex",alignItems:"center",gap:6},
  logoIcon:     {fontSize:18,lineHeight:1,display:"flex",alignItems:"center"},
  logoText:     {fontSize:20,fontWeight:900,letterSpacing:3,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:"20px",paddingTop:1},
  headerSub:    {fontSize:12,color:"#555",fontWeight:500},
  backBtn:      {background:"none",border:"none",fontSize:13,fontWeight:600,color:"#888",cursor:"pointer",padding:"4px 0"},
  errorBar:     {background:"#2a1010",borderBottom:"1px solid #5a1a1a",padding:"8px 16px",fontSize:12,color:"#f87171",display:"flex",justifyContent:"space-between"},
  errX:         {background:"none",border:"none",color:"#f87171",cursor:"pointer"},
  nav:          {background:"#0d0d0d",borderBottom:"1px solid #262626",padding:"0 16px"},
  navInner:     {display:"flex",justifyContent:"center"},
  navBtn:       {padding:"12px 10px",background:"none",border:"none",borderBottom:"2px solid transparent",color:"#555",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif",letterSpacing:0,lineHeight:1,WebkitAppearance:"none",WebkitTapHighlightColor:"transparent"},
  navOn:        {color:"#FF6200",borderBottomColor:"#FF6200"},
  main:         {paddingBottom:"calc(60px + env(safe-area-inset-bottom))"},
  page:         {padding:"0",display:"flex",flexDirection:"column",gap:0,maxWidth:600,margin:"0 auto"},
  card:         {background:"#0d0d0d",borderBottom:"1px solid #262626",padding:"20px 16px",animation:"fadeUp .25s both"},
  cardHeader:   {display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14},
  cardTitle:    {fontSize:12,fontWeight:800,letterSpacing:0,color:"#fff",fontFamily:"'Noto Sans KR',sans-serif"},
  cardSub:      {fontSize:12,color:"#555"},
  summaryRow:   {background:"#0d0d0d",borderBottom:"1px solid #262626",padding:"20px 16px",display:"flex",alignItems:"center"},
  summaryCard:  {flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  summaryNum:   {fontSize:28,fontWeight:900,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1},
  summaryLabel: {fontSize:11,fontWeight:700,letterSpacing:0,color:"#555",fontFamily:"'Noto Sans KR',sans-serif"},
  summaryDivider:{width:1,height:32,background:"#262626",flexShrink:0},
  rankRow:      {display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid #1e1e1e"},
  rankIdx:      {fontSize:16,fontWeight:900,width:20,flexShrink:0,textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1},
  rankInfo:     {flex:1,minWidth:0},
  rankTop:      {display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"},
  rankName:     {fontSize:14,fontWeight:700,color:"#fff"},
  rankBar:      {height:3,background:"#1e1e1e",borderRadius:2,overflow:"hidden"},
  rankFill:     {height:"100%",borderRadius:2,transition:"width .5s"},
  rankStat:     {display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0},
  rankRate:     {fontSize:18,fontWeight:800,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1},
  rankRecord:   {fontSize:12,color:"#555",fontWeight:500},
  tierTag:      {fontSize:12,fontWeight:700,letterSpacing:0,color:"#fff",fontFamily:"'Noto Sans KR',sans-serif"},
  profileHero:  {background:"#0d0d0d",borderBottom:"1px solid #262626",padding:"20px 16px",display:"flex",alignItems:"flex-start",gap:14},
  profileAvatar:{width:56,height:56,borderRadius:12,background:"#1e1e1e",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  profileInfo:  {flex:1},
  profileName:  {fontSize:24,fontWeight:900,color:"#fff",fontFamily:"'Noto Sans KR',sans-serif",letterSpacing:0,lineHeight:1.2},
  statGrid:     {display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:0,borderTop:"1px solid #262626",borderBottom:"1px solid #262626"},
  statBox:      {background:"#0d0d0d",padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderRight:"1px solid #262626"},
  statBig:      {fontSize:18,fontWeight:900,color:"#fff",fontFamily:"'Bebas Neue',sans-serif",lineHeight:1},
  statLabel:    {fontSize:11,fontWeight:700,letterSpacing:0,color:"#555",fontFamily:"'Noto Sans KR',sans-serif"},
  addRow:       {display:"flex",gap:8,flexWrap:"wrap"},
  input:        {flex:1,background:"#161616",border:"1px solid #333",borderRadius:8,padding:"9px 12px",color:"#fff",fontSize:13,fontWeight:500,transition:"border-color .15s"},
  select:       {background:"#161616",border:"1px solid #333",borderRadius:8,padding:"9px 32px 9px 10px",color:"#fff",fontSize:13,fontWeight:500,WebkitAppearance:"none",appearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center"},
  btnPrimary:   {background:"#FF6200",border:"none",borderRadius:999,padding:"9px 20px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"},
  btnGhost:     {background:"transparent",border:"1px solid #333",borderRadius:8,padding:"8px 14px",color:"#888",cursor:"pointer",fontSize:12,fontWeight:500},
  iconBtn:      {background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"4px 8px",color:"#555",fontWeight:600},
  delIcon:      {background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"4px 8px",color:"#ef4444",fontWeight:700},
  playerRow:    {display:"flex",alignItems:"center",gap:10,padding:"16px 0",borderBottom:"1px solid #1e1e1e"},
  playerLeft:   {flex:1,minWidth:0},
  playerTop:    {display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"},
  playerName:   {fontSize:17,fontWeight:700,color:"#fff"},
  playerStats:  {display:"flex",gap:5,flexWrap:"wrap"},
  playerActions:{display:"flex",gap:4,flexShrink:0},
  statPill:     {fontSize:12,fontWeight:600,padding:"3px 9px",borderRadius:20,background:"#1e1e1e",color:"#888"},
  editRow:      {display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"},
  scoreRow:     {display:"flex",alignItems:"center",gap:16,justifyContent:"center"},
  scoreSide:    {display:"flex",flexDirection:"column",alignItems:"center",gap:6},
  scoreLabel:   {fontSize:12,fontWeight:700,letterSpacing:1.5,color:"#555"},
  scoreInput:   {width:72,background:"#161616",border:"1px solid #333",borderRadius:10,padding:"10px 0",color:"#fff",fontSize:42,fontWeight:900,textAlign:"center",fontFamily:"'Bebas Neue',sans-serif"},
  scoreVs:      {fontSize:16,color:"#333",fontWeight:700},
  teamGrid:     {display:"flex",gap:10},
  teamCol:      {flex:1,minWidth:0},
  teamHead:     {fontSize:12,fontWeight:800,letterSpacing:1,padding:"6px 0",borderBottom:"2px solid",marginBottom:6},
  teamMember:   {display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid #1e1e1e"},
  freeList:     {paddingTop:4},
  freeBtn:      {display:"flex",alignItems:"center",gap:5,padding:"5px 0",width:"100%",background:"transparent",border:"none",color:"#555",cursor:"pointer",borderBottom:"1px solid #1e1e1e"},
  removeBtn:    {background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:12,padding:2},
  fieldLabel:   {fontSize:12,fontWeight:700,letterSpacing:1,color:"#555",marginBottom:6},
  winRow:       {display:"flex",gap:8},
  winBtn:       {flex:1,padding:"10px 0",borderRadius:8,border:"1px solid",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all .15s"},
  scoresBox:    {background:"#161616",borderRadius:8,padding:10},
  scoreItemRow: {display:"flex",alignItems:"center",gap:8,marginBottom:6},
  gameWrap:     {padding:"14px 0",borderBottom:"1px solid #1e1e1e"},
  delBtn:       {position:"absolute",top:12,right:0,background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:11,fontWeight:600},
  gcWrap:       {},
  gcMeta:       {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  gcDate:       {fontSize:12,color:"#555",fontWeight:500},
  gcMvp:        {fontSize:12,color:"#FF6200",fontWeight:600,background:"rgba(255,98,0,0.12)",padding:"2px 8px",borderRadius:4},
  gcScore:      {display:"flex",alignItems:"center",gap:8,justifyContent:"space-around"},
  gcTeamLabel:  {fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:4},
  gcBigScore:   {fontSize:44,fontWeight:900,lineHeight:1,fontFamily:"'Bebas Neue',sans-serif"},
  gcNames:      {fontSize:12,color:"#555",marginTop:4},
  gcVs:         {fontSize:18,color:"#333",fontWeight:900},
  gcPts:        {display:"flex",flexWrap:"wrap",gap:4,marginTop:10,paddingTop:10,borderTop:"1px solid #1e1e1e"},
  gcPtChip:     {fontSize:12,background:"#161616",borderRadius:4,padding:"2px 8px",color:"#888"},
};
