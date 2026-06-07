"use client";

import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase";

const TIERS = [
  { name: "DIAMOND", icon: "💎", color: "#60a5fa", min: 80 },
  { name: "PLATINUM", icon: "⬡", color: "#34d399", min: 65 },
  { name: "GOLD", icon: "★", color: "#fbbf24", min: 50 },
  { name: "SILVER", icon: "◆", color: "#9ca3af", min: 35 },
  { name: "BRONZE", icon: "●", color: "#b45309", min: 0 },
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

export default function App() {
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

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
            <button style={S.backBtn} onClick={() => setSelectedPlayer(null)}>← 뒤로</button>
            <span style={S.logoText}>HOOPS</span>
            <div style={{width:60}} />
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
          <span style={S.headerSub}>{games.length}G · {players.length}P</span>
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
        {tab === "home"    && <Home players={players} games={games} duels={duels} onSelectPlayer={setSelectedPlayer} />}
        {tab === "players" && <Players players={players} onReload={load} onSelectPlayer={setSelectedPlayer} />}
        {tab === "record"  && <RecordGame players={players} games={games} onReload={load} />}
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
        <div style={S.profileAvatar}><span style={{fontSize:32}}>🏀</span></div>
        <div style={S.profileInfo}>
          <div style={S.profileName}>{player.name}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
            <PosTag pos={player.position} />
            {tier
              ? <span style={{...S.tierTag,color:tier.color,borderColor:tier.color+"40",background:tier.color+"10"}}>{tier.icon} {tier.name}</span>
              : <span style={{...S.tierTag,color:"#9ca3af",borderColor:"#e5e7eb"}}>언랭 (3경기 필요)</span>
            }
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
                <span style={{fontSize:12,color:player.signature?"#111":"#9ca3af"}}>
                  {player.signature ? `✨ ${player.signature}` : "시그니처 무브 없음"}
                </span>
                <button style={{...S.iconBtn,fontSize:11,color:"#9ca3af"}} onClick={()=>setEditSig(true)}>✏️</button>
              </div>
            )}
          </div>
        </div>
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

      {/* 최고 득점 */}
      {bestScore > 0 && (
        <div style={{...S.card,background:"#111",border:"none"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#6b7280",marginBottom:4}}>BEST GAME</div>
              <div style={{fontSize:32,fontWeight:900,color:"#fff"}}>{bestScore} <span style={{fontSize:14,color:"#6b7280"}}>pts</span></div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>
                {new Date(bestScoreGame!.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"})}
              </div>
            </div>
            <span style={{fontSize:48}}>🏆</span>
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
              <div key={oppId} style={{...S.rankRow}}>
                <span style={{flex:1,fontSize:14,fontWeight:700}}>{pname(oppId)}</span>
                <span style={{fontSize:13,fontWeight:700,color:wr>=50?"#059669":"#dc2626"}}>{stat.wins}W {stat.losses}L</span>
                <span style={{...S.statPill,marginLeft:6,color:wr>=50?"#059669":"#dc2626",background:wr>=50?"#d1fae5":"#fee2e2"}}>{wr}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 티어 진행도 */}
      {totalGames >= 3 && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>TIER PROGRESS</span>
            {nextTier
              ? <span style={{fontSize:11,color:"#6b7280"}}>{nextTier.tier.name}까지 {nextTier.gap}점</span>
              : <span style={{fontSize:11,color:"#60a5fa"}}>최고 티어! 💎</span>
            }
          </div>
          <div style={{height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(tierScore??0,100)}%`,background:tier?.color??"#e5e7eb",borderRadius:4,transition:"width .6s"}} />
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{fontSize:10,color:"#9ca3af"}}>0</span>
            <span style={{fontSize:11,fontWeight:700,color:"#111"}}>{tierScore}점</span>
            <span style={{fontSize:10,color:"#9ca3af"}}>100</span>
          </div>
        </div>
      )}

      {/* 최근 폼 */}
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>RECENT FORM</span></div>
        {form.length === 0 ? <Empty text="경기 기록 없음" /> : (
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {form.map((r,i) => (
              <div key={i} style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",background:r==="W"?"#111":"#f8fafc",border:r==="W"?"none":"1px solid #e5e7eb",fontWeight:800,fontSize:13,color:r==="W"?"#fff":"#9ca3af"}}>{r}</div>
            ))}
            {[...Array(Math.max(0,5-form.length))].map((_,i)=>(
              <div key={`e${i}`} style={{width:36,height:36,borderRadius:8,background:"#f8fafc",border:"1px dashed #e5e7eb"}} />
            ))}
          </div>
        )}
      </div>

      {/* 베스트 파트너 / 천적 */}
      <div style={{display:"flex",gap:10}}>
        <div style={{...S.card,flex:1}}>
          <div style={S.cardHeader}><span style={S.cardTitle}>🤝 파트너</span></div>
          {bestPartner ? (
            <>
              <div style={{fontSize:15,fontWeight:800,color:"#111",marginBottom:2}}>{pname(bestPartner[0])}</div>
              <div style={{fontSize:12,color:"#6b7280"}}>같이 뛸 때 {Math.round(bestPartner[1].wins/bestPartner[1].games*100)}%</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{bestPartner[1].games}경기</div>
            </>
          ) : <Empty text="데이터 부족" />}
        </div>
        <div style={{...S.card,flex:1}}>
          <div style={S.cardHeader}><span style={S.cardTitle}>⚔️ 천적</span></div>
          {nemesis ? (
            <>
              <div style={{fontSize:15,fontWeight:800,color:"#111",marginBottom:2}}>{pname(nemesis[0])}</div>
              <div style={{fontSize:12,color:"#dc2626"}}>맞붙으면 {Math.round((1-nemesis[1].wins/nemesis[1].games)*100)}% 패배</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{nemesis[1].games}경기</div>
            </>
          ) : <Empty text="데이터 부족" />}
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
function Home({ players, games, duels, onSelectPlayer }: { players: Player[]; games: Game[]; duels: Duel[]; onSelectPlayer: (p:Player)=>void }) {
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
          <span style={S.summaryLabel}>MVP 👑</span>
        </div>
      </div>

      {hotPlayers.length>0&&(
        <div style={{...S.card,background:"#111",border:"none"}}>
          <div style={S.cardHeader}>
            <span style={{...S.cardTitle,color:"#fff"}}>🔥 요즘 핫함</span>
            <span style={{fontSize:11,color:"#6b7280"}}>최근 3연승</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {hotPlayers.map(p=>(
              <button key={p.id} style={{background:"#222",border:"none",borderRadius:20,padding:"6px 14px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
                {p.name}
              </button>
            ))}
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
              <span style={{...S.rankIdx,color:i<3?"#111":"#9ca3af"}}>{i+1}</span>
              <div style={S.rankInfo}>
                <div style={S.rankTop}>
                  <span style={S.rankName}>{p.name}</span>
                  <PosTag pos={p.position}/>
                  {tier&&<span style={{...S.tierTag,color:tier.color,borderColor:tier.color+"40",background:tier.color+"10"}}>{tier.icon} {tier.name}</span>}
                </div>
                <div style={S.rankBar}><div style={{...S.rankFill,width:`${p.win_rate||0}%`,background:i===0?"#111":"#e5e7eb"}}/></div>
              </div>
              <div style={S.rankStat}>
                <span style={S.rankRate}>{p.win_rate||0}%</span>
                <span style={S.rankRecord}>{p.wins}W {p.losses}L</span>
              </div>
              <span style={{fontSize:12,color:"#d1d5db"}}>›</span>
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
                <span style={{...S.rankIdx,color:i<3?"#111":"#9ca3af"}}>{i+1}</span>
                <div style={S.rankInfo}>
                  <div style={S.rankTop}><span style={S.rankName}>{p.name}</span><PosTag pos={p.position}/></div>
                  <div style={S.rankBar}><div style={{...S.rankFill,width:`${wr}%`,background:i===0?"#111":"#e5e7eb"}}/></div>
                </div>
                <div style={S.rankStat}>
                  <span style={S.rankRate}>{wr}%</span>
                  <span style={S.rankRecord}>{p.duel_wins||0}W {p.duel_losses||0}L</span>
                </div>
                <span style={{fontSize:12,color:"#d1d5db"}}>›</span>
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
        {mvpSorted.filter(p=>p.mvp>0).map((p,i)=>(
          <div key={p.id} style={{...S.rankRow,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
            <span style={{...S.rankIdx,color:i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#b45309":"#9ca3af"}}>{i+1}</span>
            <div style={S.rankInfo}>
              <div style={S.rankTop}><span style={S.rankName}>{p.name}</span><PosTag pos={p.position}/></div>
              <div style={S.rankBar}><div style={{...S.rankFill,width:`${Math.min((p.mvp/Math.max(...mvpSorted.map(x=>x.mvp),1))*100,100)}%`,background:"#fbbf24"}}/></div>
            </div>
            <div style={S.rankStat}>
              <span style={{...S.rankRate,color:"#fbbf24"}}>🏆 {p.mvp}</span>
              <span style={S.rankRecord}>MVP</span>
            </div>
            <span style={{fontSize:12,color:"#d1d5db"}}>›</span>
          </div>
        ))}
      </div>

      {lastGame&&(
        <div style={S.card}>
          <div style={S.cardHeader}><span style={S.cardTitle}>LAST GAME</span></div>
          <GameCard game={lastGame} players={players}/>
        </div>
      )}
    </div>
  );
}

// ── PLAYERS ───────────────────────────────────────────────────────────────────
function Players({ players, onReload, onSelectPlayer }: { players: Player[]; onReload: () => void; onSelectPlayer: (p:Player)=>void }) {
  const [name, setName] = useState("");
  const [pos, setPos] = useState("PG");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{id:string;name:string;position:string}|null>(null);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await sb.post("players",{id:uid(),name:name.trim(),position:pos,wins:0,losses:0,mvp:0,win_rate:0,avg_points:0,signature:"",best_score:0,duel_wins:0,duel_losses:0});
      setName(""); await onReload();
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
        <div style={S.addRow}>
          <input style={S.input} placeholder="이름 입력" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <select style={S.select} value={pos} onChange={e=>setPos(e.target.value)}>
            {POSITIONS.map(p=><option key={p}>{p}</option>)}
          </select>
          <button style={{...S.btnPrimary,opacity:saving?.5:1}} onClick={add} disabled={saving}>{saving?"...":"추가"}</button>
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
          return (
            <div key={p.id} style={S.playerRow}>
              {editing?.id===p.id?(
                <div style={S.editRow}>
                  <input style={{...S.input,flex:1}} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>
                  <select style={S.select} value={editing.position} onChange={e=>setEditing({...editing,position:e.target.value})}>
                    {POSITIONS.map(pos=><option key={pos}>{pos}</option>)}
                  </select>
                  <button style={S.btnPrimary} onClick={saveEdit}>저장</button>
                  <button style={S.btnGhost} onClick={()=>setEditing(null)}>취소</button>
                </div>
              ):(
                <>
                  <div style={{...S.playerLeft,cursor:"pointer"}} onClick={()=>onSelectPlayer(p)}>
                    <div style={S.playerTop}>
                      <span style={S.playerName}>{p.name}</span>
                      <PosTag pos={p.position}/>
                      {tier&&<span style={{...S.tierTag,color:tier.color,borderColor:tier.color+"40",background:tier.color+"10"}}>{tier.icon} {tier.name}</span>}
                    </div>
                    <div style={S.playerStats}>
                      <span style={S.statPill}>{p.wins}W {p.losses}L</span>
                      <span style={{...S.statPill,color:(p.win_rate||0)>=60?"#059669":(p.win_rate||0)>=40?"#d97706":"#dc2626",background:(p.win_rate||0)>=60?"#d1fae5":(p.win_rate||0)>=40?"#fef3c7":"#fee2e2"}}>{p.win_rate||0}%</span>
                      {p.mvp>0&&<span style={{...S.statPill,color:"#d97706",background:"#fef3c7"}}>🏆 ×{p.mvp}</span>}
                      {p.signature&&<span style={{...S.statPill,color:"#7c3aed",background:"#ede9fe"}}>✨ {p.signature}</span>}
                    </div>
                  </div>
                  <div style={S.playerActions}>
                    <button style={S.iconBtn} onClick={()=>setEditing({id:p.id,name:p.name,position:p.position})}>✏️</button>
                    <button style={S.iconBtn} onClick={()=>del(p.id)}>🗑</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RECORD GAME ───────────────────────────────────────────────────────────────
function RecordGame({ players, games, onReload }: { players: Player[]; games: Game[]; onReload: () => void }) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [guestsA, setGuestsA] = useState<string[]>([]);
  const [guestsB, setGuestsB] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [guestTeam, setGuestTeam] = useState<"A"|"B">("A");
  const [winner, setWinner] = useState("A");
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
      setTimeout(()=>{setDone(false);setScoreA("");setScoreB("");setTeamA([]);setTeamB([]);setGuestsA([]);setGuestsB([]);setWinner("A");setMvp("");setPlayerScores({});onReload();},1500);
    } catch(e:any){setErr(e.message);}
    finally{setSaving(false);}
  }

  if(done) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:12}}>
      <span style={{fontSize:48}}>✅</span>
      <span style={{fontSize:18,fontWeight:700,color:"#111"}}>저장 완료!</span>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>SCORE</span>
          {modeLabel()&&<span style={{fontSize:13,fontWeight:800,color:"#111",background:"#f1f5f9",padding:"3px 10px",borderRadius:20}}>{modeLabel()}</span>}
        </div>
        <div style={S.scoreRow}>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>TEAM A</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreA} onChange={e=>setScoreA(e.target.value)}/>
          </div>
          <span style={S.scoreVs}>vs</span>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>TEAM B</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreB} onChange={e=>setScoreB(e.target.value)}/>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>TEAMS</span></div>
        <div style={S.teamGrid}>
          {(["A","B"] as const).map(t=>{
            const myTeam=t==="A"?teamA:teamB;
            const myGuests=t==="A"?guestsA:guestsB;
            const accent=t==="A"?"#2563eb":"#dc2626";
            return (
              <div key={t} style={S.teamCol}>
                <div style={{...S.teamHead,borderColor:accent,color:accent}}>TEAM {t} · {myTeam.length+myGuests.length}명</div>
                {myTeam.map(id=>{const p=players.find(x=>x.id===id);return p?(
                  <div key={id} style={S.teamMember}>
                    <PosTag pos={p.position}/>
                    <span style={{flex:1,fontSize:12,fontWeight:500}}>{p.name}</span>
                    <button style={S.removeBtn} onClick={()=>toggleTeam(t,id)}>✕</button>
                  </div>
                ):null;})}
                {myGuests.map((name,i)=>(
                  <div key={`g${i}`} style={S.teamMember}>
                    <span style={{fontSize:9,padding:"2px 5px",borderRadius:3,background:"#f1f5f900",color:"#9ca3af",border:"1px solid #e5e7eb",fontWeight:700}}>GUEST</span>
                    <span style={{flex:1,fontSize:12,color:"#6b7280"}}>{name}</span>
                    <button style={S.removeBtn} onClick={()=>{
                      if(t==="A") setGuestsA(prev=>prev.filter((_,idx)=>idx!==i));
                      else setGuestsB(prev=>prev.filter((_,idx)=>idx!==i));
                    }}>✕</button>
                  </div>
                ))}
                <div style={S.freeList}>
                  {free.map(p=>(
                    <button key={p.id} style={S.freeBtn} onClick={()=>toggleTeam(t,p.id)}>
                      <PosTag pos={p.position}/><span style={{fontSize:12,flex:1,textAlign:"left"}}>{p.name}</span>
                      <span style={{color:accent,fontWeight:700}}>+</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 게스트 추가 */}
        <div style={{borderTop:"1px solid #f1f5f9",marginTop:10,paddingTop:10}}>
          <div style={S.fieldLabel}>게스트 추가</div>
          <div style={{display:"flex",gap:6}}>
            <input style={{...S.input,flex:1}} placeholder="게스트 이름" value={guestInput} onChange={e=>setGuestInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGuest()}/>
            <select style={S.select} value={guestTeam} onChange={e=>setGuestTeam(e.target.value as "A"|"B")}>
              <option value="A">팀 A</option>
              <option value="B">팀 B</option>
            </select>
            <button style={S.btnPrimary} onClick={addGuest}>추가</button>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>RESULT</span></div>
        <div style={{marginBottom:14}}>
          <div style={S.fieldLabel}>승리팀</div>
          <div style={S.winRow}>
            {(["A","B"] as const).map(t=>(
              <button key={t} onClick={()=>setWinner(t)} style={{...S.winBtn,background:winner===t?"#111":"transparent",color:winner===t?"#fff":"#6b7280",borderColor:winner===t?"#111":"#e5e7eb"}}>
                TEAM {t} {winner===t?"🏆":""}
              </button>
            ))}
          </div>
        </div>
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
        <button style={{...S.btnPrimary,width:"100%",padding:"13px 0",marginTop:12,fontSize:15,opacity:saving?.6:1}} onClick={submit} disabled={saving}>
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
      <span style={{fontSize:48}}>⚔️</span>
      <span style={{fontSize:18,fontWeight:700,color:"#111"}}>저장 완료!</span>
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
          <span style={{color:"#9ca3af",fontWeight:700,fontSize:14}}>vs</span>
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
        <button style={{...S.btnPrimary,width:"100%",padding:"13px 0",marginTop:12,fontSize:15,opacity:saving?.6:1}} onClick={submit} disabled={saving}>
          {saving?"저장 중...":"⚔️ 결과 저장"}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>1vs1 기록</span>
          <span style={S.cardSub}>{duels.length}경기</span>
        </div>
        {duels.length===0&&<Empty text="1vs1 기록이 없습니다"/>}
        {duels.slice(0,20).map(d=>{
          const date=new Date(d.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"});
          const aWon=d.winner===d.player_a;
          return (
            <div key={d.id} style={{...S.gameWrap}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#9ca3af",width:36}}>{date}</span>
                <span style={{flex:1,fontSize:14,fontWeight:aWon?800:500,color:aWon?"#111":"#9ca3af",cursor:"pointer"}} onClick={()=>{const p=players.find(x=>x.id===d.player_a);if(p)onSelectPlayer(p);}}>{pname(d.player_a)}</span>
                <span style={{fontSize:20,fontWeight:900,color:aWon?"#111":"#9ca3af"}}>{d.score_a}</span>
                <span style={{fontSize:12,color:"#d1d5db"}}>:</span>
                <span style={{fontSize:20,fontWeight:900,color:!aWon?"#111":"#9ca3af"}}>{d.score_b}</span>
                <span style={{flex:1,fontSize:14,fontWeight:!aWon?800:500,color:!aWon?"#111":"#9ca3af",textAlign:"right",cursor:"pointer"}} onClick={()=>{const p=players.find(x=>x.id===d.player_b);if(p)onSelectPlayer(p);}}>{pname(d.player_b)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function Log({ games, players, onReload }: { games: Game[]; players: Player[]; onReload: () => void }) {
  async function del(id:string) {
    if(!confirm("삭제할까요?")) return;
    await sb.del("games",`?id=eq.${id}`); onReload();
  }
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>ALL GAMES</span>
          <span style={S.cardSub}>{games.length}경기</span>
        </div>
        {games.length===0&&<Empty text="경기 기록이 없습니다"/>}
        {games.map(g=>(
          <div key={g.id} style={{...S.gameWrap,position:"relative"}}>
            <button style={S.delBtn} onClick={()=>del(g.id)}>🗑</button>
            <GameCard game={g} players={players}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GAME CARD ─────────────────────────────────────────────────────────────────
function GameCard({ game, players, highlightId }: { game: Game; players: Player[]; highlightId?: string }) {
  const pname=(id:string)=>players.find(p=>p.id===id)?.name??id.slice(0,4);
  const date=new Date(game.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"});
  const scores=game.player_scores||{};
  const hasScores=Object.keys(scores).length>0;
  const allIds=[...(game.team_a||[]),...(game.team_b||[])];
  const modeA=(game.team_a||[]).length;
  const modeB=(game.team_b||[]).length;
  return (
    <div style={S.gcWrap}>
      <div style={S.gcMeta}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={S.gcDate}>{date}</span>
          <span style={{fontSize:10,background:"#f1f5f9",borderRadius:10,padding:"1px 6px",color:"#6b7280",fontWeight:600}}>{modeA}vs{modeB}</span>
        </div>
        {game.mvp&&<span style={S.gcMvp}>🏆 MVP {pname(game.mvp)}</span>}
      </div>
      <div style={S.gcScore}>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{...S.gcTeamLabel,color:game.winner==="A"?"#111":"#9ca3af"}}>TEAM A {game.winner==="A"?"🏆":""}</div>
          <div style={{...S.gcBigScore,color:game.winner==="A"?"#111":"#d1d5db"}}>{game.score_a}</div>
          <div style={S.gcNames}>{(game.team_a||[]).map(id=><span key={id} style={{fontWeight:highlightId===id?700:400,color:highlightId===id?"#111":"#9ca3af"}}>{pname(id)}</span>).reduce((a:any,b:any,i)=>[...a,<span key={i} style={{color:"#e5e7eb"}}> · </span>,b],[])}</div>
        </div>
        <div style={S.gcVs}>:</div>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{...S.gcTeamLabel,color:game.winner==="B"?"#111":"#9ca3af"}}>TEAM B {game.winner==="B"?"🏆":""}</div>
          <div style={{...S.gcBigScore,color:game.winner==="B"?"#111":"#d1d5db"}}>{game.score_b}</div>
          <div style={S.gcNames}>{(game.team_b||[]).map(id=><span key={id} style={{fontWeight:highlightId===id?700:400,color:highlightId===id?"#111":"#9ca3af"}}>{pname(id)}</span>).reduce((a:any,b:any,i)=>[...a,<span key={i} style={{color:"#e5e7eb"}}> · </span>,b],[])}</div>
        </div>
      </div>
      {hasScores&&(
        <div style={S.gcPts}>
          {allIds.filter(id=>scores[id]).sort((a,b)=>(scores[b]||0)-(scores[a]||0)).map(id=>(
            <span key={id} style={{...S.gcPtChip,fontWeight:highlightId===id?700:400}}>{pname(id)} <b>{scores[id]}pts</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalStyle() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#f8fafc;}
    input,select,button{font-family:inherit;}
    input:focus,select:focus{outline:none;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    button:active{opacity:0.7;}
  `}</style>;
}
function PosTag({pos}:{pos:string}) {
  const c:Record<string,string>={PG:"#2563eb",SG:"#7c3aed",SF:"#059669",PF:"#d97706",C:"#dc2626"};
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:3,background:(c[pos]||"#6b7280")+"15",color:c[pos]||"#6b7280",letterSpacing:0.5,flexShrink:0}}>{pos}</span>;
}
function Empty({text}:{text:string}) {
  return <div style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:13}}>— {text} —</div>;
}

const S:Record<string,React.CSSProperties>={
  root:         {minHeight:"100vh",background:"#f8fafc",fontFamily:"'Inter',sans-serif",color:"#111"},
  loadWrap:     {display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f8fafc",gap:8},
  loadText:     {fontSize:11,fontWeight:800,letterSpacing:3,color:"#9ca3af"},
  header:       {background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"0 16px",position:"sticky",top:0,zIndex:10},
  headerInner:  {display:"flex",alignItems:"center",justifyContent:"space-between",height:52},
  logo:         {display:"flex",alignItems:"center",gap:8},
  logoIcon:     {fontSize:20},
  logoText:     {fontSize:17,fontWeight:900,letterSpacing:2,color:"#111"},
  headerSub:    {fontSize:11,color:"#9ca3af",fontWeight:500},
  backBtn:      {background:"none",border:"none",fontSize:13,fontWeight:600,color:"#6b7280",cursor:"pointer",padding:"4px 0"},
  errorBar:     {background:"#fef2f2",borderBottom:"1px solid #fecaca",padding:"8px 16px",fontSize:12,color:"#dc2626",display:"flex",justifyContent:"space-between"},
  errX:         {background:"none",border:"none",color:"#dc2626",cursor:"pointer"},
  nav:          {background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"0 16px"},
  navInner:     {display:"flex"},
  navBtn:       {padding:"12px 10px",background:"transparent",border:"none",borderBottom:"2px solid transparent",color:"#6b7280",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"},
  navOn:        {color:"#111",borderBottomColor:"#111"},
  main:         {paddingBottom:60},
  page:         {padding:"16px 14px",display:"flex",flexDirection:"column",gap:12,maxWidth:600,margin:"0 auto"},
  card:         {background:"#fff",borderRadius:12,border:"1px solid #f1f5f9",padding:"16px",animation:"fadeUp .25s both"},
  cardHeader:   {display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:14},
  cardTitle:    {fontSize:11,fontWeight:800,letterSpacing:2,color:"#111"},
  cardSub:      {fontSize:11,color:"#9ca3af"},
  summaryRow:   {background:"#fff",borderRadius:12,border:"1px solid #f1f5f9",padding:"16px",display:"flex",alignItems:"center"},
  summaryCard:  {flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  summaryNum:   {fontSize:22,fontWeight:900,color:"#111"},
  summaryLabel: {fontSize:9,fontWeight:700,letterSpacing:1.5,color:"#9ca3af"},
  summaryDivider:{width:1,height:32,background:"#f1f5f9",flexShrink:0},
  rankRow:      {display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #f8fafc"},
  rankIdx:      {fontSize:13,fontWeight:800,width:18,flexShrink:0,textAlign:"center"},
  rankInfo:     {flex:1,minWidth:0},
  rankTop:      {display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"},
  rankName:     {fontSize:14,fontWeight:700,color:"#111"},
  rankBar:      {height:3,background:"#f1f5f9",borderRadius:2,overflow:"hidden"},
  rankFill:     {height:"100%",borderRadius:2,transition:"width .5s"},
  rankStat:     {display:"flex",flexDirection:"column",alignItems:"flex-end",flexShrink:0},
  rankRate:     {fontSize:15,fontWeight:800,color:"#111"},
  rankRecord:   {fontSize:10,color:"#9ca3af",fontWeight:500},
  tierTag:      {fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:3,border:"1px solid",letterSpacing:0.5},
  profileHero:  {background:"#fff",borderRadius:12,border:"1px solid #f1f5f9",padding:16,display:"flex",alignItems:"flex-start",gap:14},
  profileAvatar:{width:56,height:56,borderRadius:12,background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  profileInfo:  {flex:1},
  profileName:  {fontSize:22,fontWeight:900,color:"#111"},
  statGrid:     {display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8},
  statBox:      {background:"#fff",borderRadius:10,border:"1px solid #f1f5f9",padding:"12px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  statBig:      {fontSize:15,fontWeight:900,color:"#111"},
  statLabel:    {fontSize:9,fontWeight:700,letterSpacing:1,color:"#9ca3af"},
  addRow:       {display:"flex",gap:8},
  input:        {flex:1,background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:"9px 12px",color:"#111",fontSize:13,fontWeight:500,transition:"border-color .15s"},
  select:       {background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:8,padding:"9px 10px",color:"#111",fontSize:13,fontWeight:500},
  btnPrimary:   {background:"#111",border:"none",borderRadius:8,padding:"9px 16px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"},
  btnGhost:     {background:"transparent",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 14px",color:"#6b7280",cursor:"pointer",fontSize:12,fontWeight:500},
  iconBtn:      {background:"none",border:"none",cursor:"pointer",fontSize:15,padding:"4px",color:"#9ca3af"},
  playerRow:    {display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:"1px solid #f8fafc",flexWrap:"wrap"},
  playerLeft:   {flex:1},
  playerTop:    {display:"flex",alignItems:"center",gap:5,marginBottom:4,flexWrap:"wrap"},
  playerName:   {fontSize:14,fontWeight:700,color:"#111"},
  playerStats:  {display:"flex",gap:4,flexWrap:"wrap"},
  playerActions:{display:"flex",gap:2},
  statPill:     {fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:20,background:"#f1f5f9",color:"#6b7280"},
  editRow:      {display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"},
  scoreRow:     {display:"flex",alignItems:"center",gap:16,justifyContent:"center"},
  scoreSide:    {display:"flex",flexDirection:"column",alignItems:"center",gap:6},
  scoreLabel:   {fontSize:10,fontWeight:700,letterSpacing:1.5,color:"#9ca3af"},
  scoreInput:   {width:88,background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 0",color:"#111",fontSize:36,fontWeight:900,textAlign:"center"},
  scoreVs:      {fontSize:16,color:"#d1d5db",fontWeight:700},
  teamGrid:     {display:"flex",gap:10},
  teamCol:      {flex:1,minWidth:0},
  teamHead:     {fontSize:10,fontWeight:800,letterSpacing:1,padding:"6px 0",borderBottom:"2px solid",marginBottom:6},
  teamMember:   {display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:"1px solid #f8fafc"},
  freeList:     {paddingTop:4},
  freeBtn:      {display:"flex",alignItems:"center",gap:5,padding:"5px 0",width:"100%",background:"transparent",border:"none",color:"#9ca3af",cursor:"pointer",borderBottom:"1px solid #f8fafc"},
  removeBtn:    {background:"none",border:"none",color:"#d1d5db",cursor:"pointer",fontSize:12,padding:2},
  fieldLabel:   {fontSize:10,fontWeight:700,letterSpacing:1,color:"#9ca3af",marginBottom:6},
  winRow:       {display:"flex",gap:8},
  winBtn:       {flex:1,padding:"10px 0",borderRadius:8,border:"1px solid",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all .15s"},
  scoresBox:    {background:"#f8fafc",borderRadius:8,padding:10},
  scoreItemRow: {display:"flex",alignItems:"center",gap:8,marginBottom:6},
  gameWrap:     {padding:"12px 0",borderBottom:"1px solid #f8fafc"},
  delBtn:       {position:"absolute",top:12,right:0,background:"none",border:"none",color:"#e5e7eb",cursor:"pointer",fontSize:14},
  gcWrap:       {},
  gcMeta:       {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10},
  gcDate:       {fontSize:11,color:"#9ca3af",fontWeight:500},
  gcMvp:        {fontSize:11,color:"#d97706",fontWeight:600,background:"#fef3c7",padding:"2px 8px",borderRadius:4},
  gcScore:      {display:"flex",alignItems:"center",gap:8,justifyContent:"space-around"},
  gcTeamLabel:  {fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:4},
  gcBigScore:   {fontSize:38,fontWeight:900,lineHeight:1},
  gcNames:      {fontSize:10,color:"#9ca3af",marginTop:4},
  gcVs:         {fontSize:18,color:"#e5e7eb",fontWeight:900},
  gcPts:        {display:"flex",flexWrap:"wrap",gap:4,marginTop:10,paddingTop:10,borderTop:"1px solid #f8fafc"},
  gcPtChip:     {fontSize:11,background:"#f8fafc",borderRadius:4,padding:"2px 8px",color:"#6b7280"},
};
