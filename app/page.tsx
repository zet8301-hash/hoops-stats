"use client";

import { useState, useEffect, useCallback } from "react";
import { sb } from "../lib/supabase";

// ─── TIER ────────────────────────────────────────────────────────────────────
const TIERS = [
  { name: "다이아",    icon: "💎", color: "#a8edff", glow: "#a8edff66", min: 80 },
  { name: "플래티넘",  icon: "🪙", color: "#8effc1", glow: "#8effc166", min: 65 },
  { name: "골드",      icon: "🥇", color: "#ffd23f", glow: "#ffd23f66", min: 50 },
  { name: "실버",      icon: "🥈", color: "#c0c0c0", glow: "#c0c0c066", min: 35 },
  { name: "브론즈",    icon: "🥉", color: "#cd7f32", glow: "#cd7f3266", min: 0  },
];

interface Player {
  id: string; name: string; position: string;
  wins: number; losses: number; mvp: number; win_rate: number;
}
interface Game {
  id: string; created_at: string;
  score_a: number; score_b: number;
  team_a: string[]; team_b: string[];
  winner: string; mvp: string | null;
  player_scores: Record<string, number>;
}

function getTier(p: Player) {
  const g = p.wins + p.losses;
  if (g < 3) return null;
  const score = p.win_rate * 0.7 + Math.min(p.mvp / 10, 1) * 100 * 0.3;
  return TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1];
}
function uid() { return crypto.randomUUID(); }
const POSITIONS = ["PG","SG","SF","PF","C"];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [games,   setGames]   = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([
        sb.get("players", "?order=win_rate.desc"),
        sb.get("games",   "?order=created_at.desc"),
      ]);
      setPlayers(p ?? []); setGames(g ?? []);
    } catch (e: any) { setError("Supabase 연결 실패: " + e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  return (
    <div style={S.root}>
      <Header />
      {error && (
        <div style={S.errorBar}>
          {error}
          <button style={S.errClose} onClick={() => setError("")}>✕</button>
        </div>
      )}
      <nav style={S.nav}>
        {[["home","🏠","홈"],["players","👤","선수"],["record","🎮","기록"],["log","📋","경기"]] .map(([k,ic,v]) => (
          <button key={k} style={{...S.navBtn, ...(tab===k ? S.navActive : {})}} onClick={() => setTab(k)}>
            <span style={{fontSize:16}}>{ic}</span>
            <span style={{fontSize:10}}>{v}</span>
          </button>
        ))}
      </nav>
      <main style={S.main}>
        {tab==="home"    && <Home    players={players} games={games} />}
        {tab==="players" && <Players players={players} onReload={load} />}
        {tab==="record"  && <RecordGame players={players} games={games} onReload={load} />}
        {tab==="log"     && <Log     games={games} players={players} onReload={load} />}
      </main>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
function Home({ players, games }: { players: Player[]; games: Game[] }) {
  const sorted  = [...players].sort((a,b) => (b.win_rate||0) - (a.win_rate||0));
  const mvpKing = [...players].sort((a,b) => (b.mvp||0) - (a.mvp||0))[0];
  const lastGame = games[0];

  return (
    <div style={S.page}>
      <div style={S.cardRow}>
        <MiniCard icon="🎮" label="총 경기" value={games.length} color="#ff6b35" />
        <MiniCard icon="👥" label="선수"    value={players.length} color="#ffd23f" />
        <MiniCard icon="🏆" label="MVP킹"   value={mvpKing?.name ?? "-"} color="#06ffa5" small />
      </div>

      <section style={S.section}>
        <SectionTitle>🔥 승률 랭킹</SectionTitle>
        {sorted.length === 0 && <Empty text="선수를 먼저 추가하세요" />}
        {sorted.map((p, i) => {
          const tier = getTier(p);
          return (
            <div key={p.id} style={{...S.rankRow, background: i===0 ? "rgba(255,107,53,0.1)" : "rgba(255,255,255,0.02)"}}>
              <span style={{...S.rankNum, color: ["#ffd23f","#c0c0c0","#cd7f32","#777","#555"][Math.min(i,4)]}}>{i+1}</span>
              {tier
                ? <span style={{...S.tierBadge, color:tier.color, borderColor:tier.color+"44"}}>{tier.icon}{tier.name}</span>
                : <span style={{...S.tierBadge, color:"#444", borderColor:"#222"}}>— 언랭</span>
              }
              <PosChip pos={p.position} />
              <span style={S.rankName}>{p.name}</span>
              <div style={S.rankBarWrap}>
                <div style={{...S.rankBarFill, width:`${p.win_rate||0}%`, background: i===0 ? "linear-gradient(90deg,#ff6b35,#ff9f1c)" : "#2a4a7a"}} />
              </div>
              <span style={S.rankRate}>{p.win_rate||0}%</span>
              <span style={S.rankGames}>{p.wins}W {p.losses}L</span>
            </div>
          );
        })}
      </section>

      <section style={S.section}>
        <SectionTitle>💎 티어 기준</SectionTitle>
        <div style={{fontSize:11, color:"#555", marginBottom:10}}>최소 3경기 · 승률(70%) + MVP기여도(30%)</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {TIERS.map(t => (
            <div key={t.name} style={{background:"#0a0a14", border:`1px solid ${t.color}44`, borderRadius:8, padding:"6px 10px", display:"flex", alignItems:"center", gap:4}}>
              <span>{t.icon}</span>
              <span style={{color:t.color, fontSize:12, fontWeight:700}}>{t.name}</span>
              <span style={{color:"#555", fontSize:10}}>{t.min}+</span>
            </div>
          ))}
        </div>
      </section>

      {lastGame && (
        <section style={S.section}>
          <SectionTitle>🎮 최근 경기</SectionTitle>
          <GameCard game={lastGame} players={players} />
        </section>
      )}
    </div>
  );
}

// ─── PLAYERS ──────────────────────────────────────────────────────────────────
function Players({ players, onReload }: { players: Player[]; onReload: () => void }) {
  const [name, setName]       = useState("");
  const [pos, setPos]         = useState("PG");
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState<{id:string;name:string;position:string}|null>(null);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try { await sb.post("players", { id: uid(), name: name.trim(), position: pos, wins:0, losses:0, mvp:0, win_rate:0 }); setName(""); await onReload(); }
    finally { setSaving(false); }
  }
  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    await sb.del("players", `?id=eq.${id}`); onReload();
  }
  async function saveEdit() {
    if (!editing) return;
    await sb.patch("players", { name: editing.name, position: editing.position }, `?id=eq.${editing.id}`);
    setEditing(null); onReload();
  }

  return (
    <div style={S.page}>
      <section style={S.formCard}>
        <SectionTitle>➕ 선수 추가</SectionTitle>
        <div style={S.formRow}>
          <input style={S.input} placeholder="이름" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} />
          <select style={S.select} value={pos} onChange={e=>setPos(e.target.value)}>
            {POSITIONS.map(p=><option key={p}>{p}</option>)}
          </select>
          <button style={{...S.btnOrange, opacity:saving?.5:1}} onClick={add} disabled={saving}>{saving?"...":"추가"}</button>
        </div>
      </section>

      <section style={S.section}>
        <SectionTitle>👥 선수 목록 ({players.length}명)</SectionTitle>
        {players.length===0 && <Empty text="선수가 없습니다" />}
        {players.map(p => {
          const tier = getTier(p);
          return (
            <div key={p.id} style={S.playerRow}>
              {editing?.id===p.id ? (
                <div style={{display:"flex",gap:8,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                  <input style={{...S.input,flex:1}} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} />
                  <select style={S.select} value={editing.position} onChange={e=>setEditing({...editing,position:e.target.value})}>
                    {POSITIONS.map(pos=><option key={pos}>{pos}</option>)}
                  </select>
                  <button style={S.btnGreen} onClick={saveEdit}>저장</button>
                  <button style={S.btnGhost} onClick={()=>setEditing(null)}>취소</button>
                </div>
              ) : (
                <>
                  <PosChip pos={p.position} />
                  <span style={S.playerName}>{p.name}</span>
                  {tier && <span style={{...S.tierBadge, color:tier.color, borderColor:tier.color+"44", fontSize:10}}>{tier.icon}{tier.name}</span>}
                  <div style={S.statChips}>
                    <Chip>{p.wins}W</Chip>
                    <Chip>{p.losses}L</Chip>
                    <Chip color={(p.win_rate||0)>=60?"#06ffa5":(p.win_rate||0)>=40?"#ffd23f":"#ff4d6d"}>{p.win_rate||0}%</Chip>
                    {p.mvp>0 && <Chip color="#ffd23f">🏆×{p.mvp}</Chip>}
                  </div>
                  <button style={S.iconBtn} onClick={()=>setEditing({id:p.id,name:p.name,position:p.position})}>✏️</button>
                  <button style={{...S.iconBtn,color:"#ff4d6d"}} onClick={()=>del(p.id)}>🗑</button>
                </>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ─── RECORD GAME ──────────────────────────────────────────────────────────────
function RecordGame({ players, games, onReload }: { players: Player[]; games: Game[]; onReload: () => void }) {
  const [scoreA, setScoreA]           = useState("");
  const [scoreB, setScoreB]           = useState("");
  const [teamA,  setTeamA]            = useState<string[]>([]);
  const [teamB,  setTeamB]            = useState<string[]>([]);
  const [winner, setWinner]           = useState("A");
  const [mvp,    setMvp]              = useState("");
  const [playerScores, setPlayerScores] = useState<Record<string,string>>({});
  const [showScores, setShowScores]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [err,    setErr]              = useState("");
  const [done,   setDone]             = useState(false);

  const inTeam = [...teamA, ...teamB];
  const free   = players.filter(p => !inTeam.includes(p.id));
  const allTeamPlayers = inTeam.map(id => players.find(p=>p.id===id)).filter(Boolean) as Player[];

  function toggleTeam(team: "A"|"B", id: string) {
    if (team==="A") setTeamA(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
    else            setTeamB(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
  }

  async function submit() {
    if (!scoreA || !scoreB) return setErr("스코어를 입력하세요");
    if (teamA.length<1 || teamB.length<1) return setErr("각 팀 최소 1명");
    setErr(""); setSaving(true);
    try {
      const scores: Record<string,number> = {};
      Object.entries(playerScores).forEach(([k,v]) => { if(v) scores[k] = Number(v); });

      await sb.post("games", {
        id: uid(), score_a: Number(scoreA), score_b: Number(scoreB),
        team_a: teamA, team_b: teamB, winner, mvp: mvp||null, player_scores: scores,
      });

      const winTeam  = winner==="A" ? teamA : teamB;
      const loseTeam = winner==="A" ? teamB : teamA;
      await Promise.all(players.map(async p => {
        const isWin  = winTeam.includes(p.id);
        const isLose = loseTeam.includes(p.id);
        if (!isWin && !isLose) return;
        const nw = p.wins   + (isWin  ? 1 : 0);
        const nl = p.losses + (isLose ? 1 : 0);
        const nm = p.mvp    + (mvp===p.id ? 1 : 0);
        const nr = nw+nl > 0 ? Math.round((nw/(nw+nl))*100) : 0;
        await sb.patch("players", { wins:nw, losses:nl, mvp:nm, win_rate:nr }, `?id=eq.${p.id}`);
      }));

      setDone(true);
      setTimeout(() => {
        setDone(false);
        setScoreA(""); setScoreB(""); setTeamA([]); setTeamB([]);
        setWinner("A"); setMvp(""); setPlayerScores({});
        onReload();
      }, 1500);
    } catch(e:any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:16}}>
      <div style={{fontSize:64}}>🎉</div>
      <p style={{color:"#06ffa5",fontSize:18,fontWeight:700,fontFamily:"'Black Han Sans'"}}>저장 완료!</p>
    </div>
  );

  return (
    <div style={S.page}>
      <section style={S.formCard}>
        <SectionTitle>🎮 경기 기록</SectionTitle>

        <div style={S.scoreRow}>
          <div style={S.scoreSide}>
            <span style={{fontSize:11,color:"#ff6b35",letterSpacing:1}}>🔴 팀 A</span>
            <input style={S.scoreBox} type="number" min="0" placeholder="0" value={scoreA} onChange={e=>setScoreA(e.target.value)} />
          </div>
          <div style={{color:"#333",fontSize:24,fontWeight:900}}>:</div>
          <div style={S.scoreSide}>
            <span style={{fontSize:11,color:"#4a90d9",letterSpacing:1}}>🔵 팀 B</span>
            <input style={S.scoreBox} type="number" min="0" placeholder="0" value={scoreB} onChange={e=>setScoreB(e.target.value)} />
          </div>
        </div>

        <div style={S.teamGrid}>
          {(["A","B"] as const).map(t => {
            const myTeam = t==="A" ? teamA : teamB;
            const col    = t==="A" ? "#ff6b35" : "#4a90d9";
            return (
              <div key={t} style={{...S.teamPanel, borderColor:col+"55"}}>
                <div style={{background:col+"18", padding:"6px 10px", display:"flex", justifyContent:"space-between"}}>
                  <span style={{color:col,fontWeight:700,fontSize:13}}>팀 {t}</span>
                  <span style={{color:"#555",fontSize:11}}>{myTeam.length}명</span>
                </div>
                {myTeam.map(id => {
                  const p = players.find(x=>x.id===id);
                  return p ? (
                    <div key={id} style={S.teamMem}>
                      <PosChip pos={p.position} />
                      <span style={{flex:1,fontSize:12}}>{p.name}</span>
                      <button style={{background:"none",border:"none",color:"#ff4d6d",cursor:"pointer",fontSize:12}} onClick={()=>toggleTeam(t,id)}>✕</button>
                    </div>
                  ) : null;
                })}
                <div style={{borderTop:"1px solid #1a1a28", padding:"4px 0"}}>
                  {free.map(p => (
                    <button key={p.id} style={S.freePlayerBtn} onClick={()=>toggleTeam(t,p.id)}>
                      <PosChip pos={p.position} />
                      <span style={{fontSize:11}}>{p.name}</span>
                      <span style={{marginLeft:"auto",color:col,fontSize:14}}>+</span>
                    </button>
                  ))}
                  {free.length===0 && <p style={{fontSize:10,color:"#444",padding:"4px 10px"}}>모든 선수 배정됨</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"#666",marginBottom:6}}>승리팀</div>
          <div style={{display:"flex",gap:8}}>
            {(["A","B"] as const).map(t => (
              <button key={t} onClick={()=>setWinner(t)} style={{
                flex:1, padding:"9px 0", borderRadius:8,
                border:`1px solid ${winner===t?(t==="A"?"#ff6b35":"#4a90d9"):"#222"}`,
                background: winner===t?(t==="A"?"#ff6b3522":"#4a90d922"):"transparent",
                color: winner===t?(t==="A"?"#ff6b35":"#4a90d9"):"#555",
                cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"'Noto Sans KR'"
              }}>팀 {t} {winner===t?"🏆":""}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"#666",marginBottom:6}}>MVP (선택)</div>
          <select style={{...S.select,width:"100%"}} value={mvp} onChange={e=>setMvp(e.target.value)}>
            <option value="">없음</option>
            {allTeamPlayers.map(p=><option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
          </select>
        </div>

        <div style={{marginBottom:12}}>
          <button style={{...S.btnGhost,width:"100%",marginBottom:6}} onClick={()=>setShowScores(!showScores)}>
            {showScores?"▲":"▼"} 개인 득점 기록 (선택)
          </button>
          {showScores && (
            <div style={{background:"#0a0a14",border:"1px solid #1e1e30",borderRadius:8,padding:10}}>
              {allTeamPlayers.length===0 && <p style={{color:"#555",fontSize:12,textAlign:"center"}}>팀원을 먼저 추가하세요</p>}
              {allTeamPlayers.map(p => (
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <PosChip pos={p.position} />
                  <span style={{flex:1,fontSize:12,color:teamA.includes(p.id)?"#ff6b35":"#4a90d9"}}>{p.name}</span>
                  <input style={{...S.input,width:60,textAlign:"center",padding:"5px 8px"}}
                    type="number" min="0" placeholder="0"
                    value={playerScores[p.id]||""}
                    onChange={e=>setPlayerScores(prev=>({...prev,[p.id]:e.target.value}))} />
                  <span style={{fontSize:11,color:"#555"}}>점</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <p style={{color:"#ff4d6d",fontSize:12,marginBottom:8}}>{err}</p>}
        <button style={{...S.btnOrange,width:"100%",padding:"12px 0",fontSize:15,opacity:saving?.6:1}} onClick={submit} disabled={saving}>
          {saving?"저장 중...":"💾 경기 저장"}
        </button>
      </section>
    </div>
  );
}

// ─── LOG ──────────────────────────────────────────────────────────────────────
function Log({ games, players, onReload }: { games: Game[]; players: Player[]; onReload: () => void }) {
  async function del(id: string) {
    if (!confirm("이 경기 기록을 삭제할까요?")) return;
    await sb.del("games", `?id=eq.${id}`); onReload();
  }
  return (
    <div style={S.page}>
      <SectionTitle>📋 경기 기록 ({games.length})</SectionTitle>
      {games.length===0 && <Empty text="경기 기록이 없습니다" />}
      {games.map(g => (
        <div key={g.id} style={{...S.gameCard, position:"relative"}}>
          <button style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:"#ff4d6d44",cursor:"pointer",fontSize:16}} onClick={()=>del(g.id)}>🗑</button>
          <GameCard game={g} players={players} />
        </div>
      ))}
    </div>
  );
}

// ─── GAME CARD ────────────────────────────────────────────────────────────────
function GameCard({ game, players }: { game: Game; players: Player[] }) {
  const pname = (id: string) => players.find(p=>p.id===id)?.name ?? "?";
  const date  = new Date(game.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const scores = game.player_scores || {};
  const hasScores = Object.keys(scores).length > 0;
  const allIds = [...(game.team_a||[]), ...(game.team_b||[])];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color:"#555",fontSize:11}}>{date}</span>
        {game.mvp && <span style={{background:"#ffd23f18",color:"#ffd23f",fontSize:11,padding:"2px 8px",borderRadius:4}}>🏆 MVP {pname(game.mvp)}</span>}
      </div>
      <div style={{display:"flex",justifyContent:"space-around",alignItems:"center",gap:8}}>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontSize:10,color:"#ff6b35",marginBottom:4}}>팀 A {game.winner==="A"?"🏆":""}</div>
          <div style={{fontSize:36,fontWeight:900,fontFamily:"'Black Han Sans'",color:game.winner==="A"?"#ff6b35":"#e8e8e8"}}>{game.score_a}</div>
          <div style={{fontSize:10,color:"#555",marginTop:4}}>{(game.team_a||[]).map(pname).join(" · ")}</div>
        </div>
        <div style={{color:"#333",fontSize:20,fontWeight:900}}>VS</div>
        <div style={{textAlign:"center",flex:1}}>
          <div style={{fontSize:10,color:"#4a90d9",marginBottom:4}}>팀 B {game.winner==="B"?"🏆":""}</div>
          <div style={{fontSize:36,fontWeight:900,fontFamily:"'Black Han Sans'",color:game.winner==="B"?"#4a90d9":"#e8e8e8"}}>{game.score_b}</div>
          <div style={{fontSize:10,color:"#555",marginTop:4}}>{(game.team_b||[]).map(pname).join(" · ")}</div>
        </div>
      </div>
      {hasScores && (
        <div style={{marginTop:10,borderTop:"1px solid #1a1a28",paddingTop:8}}>
          <div style={{fontSize:10,color:"#555",marginBottom:4}}>개인 득점</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {allIds.filter(id=>scores[id]).sort((a,b)=>(scores[b]||0)-(scores[a]||0)).map(id=>(
              <span key={id} style={{background:"#1a1a28",borderRadius:4,padding:"2px 7px",fontSize:11,color:"#aaa"}}>
                {pname(id)} <b style={{color:"#ff6b35"}}>{scores[id]}점</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function Header() {
  return (
    <header style={{background:"linear-gradient(135deg,#150800,#081520)",borderBottom:"1px solid #ff6b3525",padding:"14px 16px 10px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 20px,#ffffff04 20px,#ffffff04 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,#ffffff04 20px,#ffffff04 21px)"}} />
      <div style={{position:"relative",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:30}}>🏀</span>
        <div>
          <div style={{fontFamily:"'Black Han Sans'",fontSize:22,color:"#ff6b35",letterSpacing:3,lineHeight:1}}>HOOPS STATS</div>
          <div style={{fontSize:9,color:"#ff6b3580",letterSpacing:2}}>BASKETBALL TRACKER</div>
        </div>
      </div>
    </header>
  );
}
function Loader() {
  return (
    <div style={{...S.root,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:12}}>
      <div style={{fontSize:48}}>🏀</div>
      <div style={{color:"#ff6b35",fontFamily:"'Black Han Sans'",letterSpacing:2}}>LOADING...</div>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{fontSize:11,fontWeight:700,color:"#666",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>{children}</h2>;
}
function MiniCard({ icon, label, value, color, small }: { icon:string; label:string; value:string|number; color:string; small?:boolean }) {
  return (
    <div style={{flex:1,background:"#0f0f1a",border:`1px solid ${color}33`,borderRadius:10,padding:"12px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <span style={{fontSize:20}}>{icon}</span>
      <span style={{fontWeight:900,color,fontSize:small?14:22,fontFamily:"'Black Han Sans'"}}>{value}</span>
      <span style={{fontSize:9,color:"#555",letterSpacing:1}}>{label}</span>
    </div>
  );
}
function PosChip({ pos }: { pos: string }) {
  const c: Record<string,string> = {PG:"#ff6b35",SG:"#ffd23f",SF:"#06ffa5",PF:"#4a90d9",C:"#c77dff"};
  return <span style={{fontSize:9,padding:"2px 5px",borderRadius:3,background:(c[pos]||"#aaa")+"22",color:c[pos]||"#aaa",fontWeight:700,letterSpacing:0.5,flexShrink:0}}>{pos}</span>;
}
function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span style={{background:(color||"#aaa")+"18",color:color||"#888",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700}}>{children}</span>;
}
function Empty({ text }: { text: string }) {
  return <div style={{textAlign:"center",padding:"32px 0",color:"#444",fontSize:13}}>🏀 {text}</div>;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:       { minHeight:"100vh", background:"#07070f", color:"#e0e0e0", fontFamily:"'Noto Sans KR', sans-serif" },
  errorBar:   { background:"#ff4d6d22", borderBottom:"1px solid #ff4d6d44", padding:"8px 16px", fontSize:12, color:"#ff4d6d", display:"flex", justifyContent:"space-between", alignItems:"center" },
  errClose:   { background:"none", border:"none", color:"#ff4d6d", cursor:"pointer", fontSize:14 },
  nav:        { display:"flex", background:"#0a0a14", borderBottom:"1px solid #1a1a28" },
  navBtn:     { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"10px 4px", background:"transparent", border:"none", color:"#555", cursor:"pointer", borderBottom:"2px solid transparent", transition:"all .2s" },
  navActive:  { color:"#ff6b35", borderBottomColor:"#ff6b35", background:"#ff6b3508" },
  main:       { paddingBottom:80 },
  page:       { padding:"14px 12px", display:"flex", flexDirection:"column", gap:14 },
  section:    { background:"#0c0c18", border:"1px solid #1a1a28", borderRadius:10, padding:14 },
  formCard:   { background:"#0c0c18", border:"1px solid #ff6b3530", borderRadius:10, padding:14 },
  cardRow:    { display:"flex", gap:8 },
  rankRow:    { display:"flex", alignItems:"center", gap:6, padding:"8px 10px", borderRadius:8, marginBottom:4, flexWrap:"wrap" },
  rankNum:    { fontSize:16, fontWeight:900, width:20, textAlign:"center", fontFamily:"'Black Han Sans'", flexShrink:0 },
  tierBadge:  { fontSize:10, padding:"2px 6px", borderRadius:4, border:"1px solid", fontWeight:700, flexShrink:0 },
  rankName:   { fontSize:13, fontWeight:700, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:50 },
  rankBarWrap:{ width:60, height:4, background:"#1a1a28", borderRadius:2, overflow:"hidden", flexShrink:0 },
  rankBarFill:{ height:"100%", borderRadius:2, transition:"width .6s" },
  rankRate:   { fontSize:12, fontWeight:700, color:"#ff6b35", width:34, textAlign:"right", flexShrink:0 },
  rankGames:  { fontSize:10, color:"#444", width:44, textAlign:"right", flexShrink:0 },
  formRow:    { display:"flex", gap:8, alignItems:"center", marginBottom:8 },
  input:      { flex:1, background:"#080814", border:"1px solid #1e1e30", borderRadius:6, padding:"8px 10px", color:"#e0e0e0", fontSize:13, fontFamily:"'Noto Sans KR'", transition:"border-color .2s" },
  select:     { background:"#080814", border:"1px solid #1e1e30", borderRadius:6, padding:"8px 10px", color:"#e0e0e0", fontSize:13, fontFamily:"'Noto Sans KR'" },
  btnOrange:  { background:"linear-gradient(135deg,#ff6b35,#ff9f1c)", border:"none", borderRadius:6, padding:"8px 16px", color:"#000", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"'Noto Sans KR'" },
  btnGreen:   { background:"#06ffa5", border:"none", borderRadius:6, padding:"8px 12px", color:"#000", fontWeight:700, cursor:"pointer", fontSize:12 },
  btnGhost:   { background:"transparent", border:"1px solid #222", borderRadius:6, padding:"7px 12px", color:"#666", cursor:"pointer", fontSize:12, fontFamily:"'Noto Sans KR'" },
  iconBtn:    { background:"transparent", border:"none", cursor:"pointer", fontSize:14, color:"#555", padding:"4px" },
  playerRow:  { display:"flex", alignItems:"center", gap:6, padding:"8px 0", borderBottom:"1px solid #111", flexWrap:"wrap" },
  playerName: { flex:1, fontSize:13, fontWeight:700, minWidth:50 },
  statChips:  { display:"flex", gap:4, flexWrap:"wrap" },
  scoreRow:   { display:"flex", alignItems:"center", gap:8, marginBottom:16, justifyContent:"center" },
  scoreSide:  { display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
  scoreBox:   { width:80, background:"#080814", border:"1px solid #2a2a40", borderRadius:10, padding:"10px 0", color:"#e0e0e0", fontSize:32, fontWeight:900, textAlign:"center", fontFamily:"'Black Han Sans'" },
  teamGrid:   { display:"flex", gap:8, marginBottom:12 },
  teamPanel:  { flex:1, border:"1px solid", borderRadius:8, overflow:"hidden", minWidth:0 },
  teamMem:    { display:"flex", alignItems:"center", gap:6, padding:"5px 10px", background:"#0a0a14", borderTop:"1px solid #111" },
  freePlayerBtn: { display:"flex", alignItems:"center", gap:5, padding:"5px 10px", width:"100%", background:"transparent", border:"none", color:"#555", cursor:"pointer", borderTop:"1px solid #0e0e1a" },
  gameCard:   { background:"#0c0c18", border:"1px solid #1a1a28", borderRadius:10, padding:14, marginBottom:8 },
};
