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

export default function App() {
  const [tab, setTab] = useState("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([
        sb.get("players", "?order=win_rate.desc"),
        sb.get("games", "?order=created_at.desc"),
      ]);
      setPlayers(p ?? []); setGames(g ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={S.loadWrap}>
      <div style={S.loadDot} />
      <span style={S.loadText}>Loading</span>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; }
        input, select, button { font-family: inherit; }
        input:focus, select:focus { outline: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        button:active { opacity: 0.7; }
      `}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoIcon}>🏀</span>
            <span style={S.logoText}>HOOPS</span>
          </div>
          <div style={S.headerRight}>
            <span style={S.headerSub}>{games.length} Games · {players.length} Players</span>
          </div>
        </div>
      </header>

      {error && (
        <div style={S.errorBar}>
          {error}
          <button style={S.errX} onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          {[["home","홈"],["players","선수"],["record","기록"],["log","경기"]] .map(([k, v]) => (
            <button key={k} style={{...S.navBtn, ...(tab===k ? S.navOn : {})}} onClick={() => setTab(k)}>
              {v}
            </button>
          ))}
        </div>
      </nav>

      <main style={S.main}>
        {tab === "home"    && <Home players={players} games={games} />}
        {tab === "players" && <Players players={players} onReload={load} />}
        {tab === "record"  && <RecordGame players={players} games={games} onReload={load} />}
        {tab === "log"     && <Log games={games} players={players} onReload={load} />}
      </main>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function Home({ players, games }: { players: Player[]; games: Game[] }) {
  const sorted = [...players].sort((a, b) => (b.win_rate||0) - (a.win_rate||0));
  const mvpKing = [...players].sort((a, b) => (b.mvp||0) - (a.mvp||0))[0];
  const lastGame = games[0];

  return (
    <div style={S.page}>
      {/* Summary */}
      <div style={S.summaryRow}>
        <div style={S.summaryCard}>
          <span style={S.summaryNum}>{games.length}</span>
          <span style={S.summaryLabel}>GAMES</span>
        </div>
        <div style={S.summaryDivider} />
        <div style={S.summaryCard}>
          <span style={S.summaryNum}>{players.length}</span>
          <span style={S.summaryLabel}>PLAYERS</span>
        </div>
        <div style={S.summaryDivider} />
        <div style={S.summaryCard}>
          <span style={{...S.summaryNum, fontSize: 16}}>{mvpKing?.name ?? "—"}</span>
          <span style={S.summaryLabel}>MVP KING 🏆</span>
        </div>
      </div>

      {/* Ranking */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>RANKING</span>
          <span style={S.cardSub}>승률 기준</span>
        </div>
        {sorted.length === 0 && <Empty text="선수를 추가하세요" />}
        {sorted.map((p, i) => {
          const tier = getTier(p);
          return (
            <div key={p.id} style={{...S.rankRow, animationDelay: `${i * 40}ms`}}>
              <span style={{...S.rankIdx, color: i < 3 ? "#111" : "#9ca3af"}}>{i + 1}</span>
              <div style={S.rankInfo}>
                <div style={S.rankTop}>
                  <span style={S.rankName}>{p.name}</span>
                  <PosTag pos={p.position} />
                  {tier && <span style={{...S.tierTag, color: tier.color, borderColor: tier.color + "40", background: tier.color + "10"}}>{tier.icon} {tier.name}</span>}
                </div>
                <div style={S.rankBar}>
                  <div style={{...S.rankFill, width: `${p.win_rate||0}%`, background: i === 0 ? "#111" : "#e5e7eb"}} />
                </div>
              </div>
              <div style={S.rankStat}>
                <span style={S.rankRate}>{p.win_rate||0}%</span>
                <span style={S.rankRecord}>{p.wins}W {p.losses}L</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier guide */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>TIER</span>
          <span style={S.cardSub}>최소 3경기 · 승률 70% + MVP 30%</span>
        </div>
        <div style={S.tierRow}>
          {TIERS.map(t => (
            <div key={t.name} style={{...S.tierItem, borderColor: t.color + "40", background: t.color + "08"}}>
              <span style={{fontSize: 16}}>{t.icon}</span>
              <span style={{...S.tierName, color: t.color}}>{t.name}</span>
              <span style={S.tierMin}>{t.min}+</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last game */}
      {lastGame && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>LAST GAME</span>
          </div>
          <GameCard game={lastGame} players={players} />
        </div>
      )}
    </div>
  );
}

// ── PLAYERS ───────────────────────────────────────────────────────────────────
function Players({ players, onReload }: { players: Player[]; onReload: () => void }) {
  const [name, setName] = useState("");
  const [pos, setPos] = useState("PG");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{id:string;name:string;position:string}|null>(null);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await sb.post("players", { id: uid(), name: name.trim(), position: pos, wins:0, losses:0, mvp:0, win_rate:0 });
      setName(""); await onReload();
    } finally { setSaving(false); }
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
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>ADD PLAYER</span></div>
        <div style={S.addRow}>
          <input style={S.input} placeholder="이름 입력" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          <select style={S.select} value={pos} onChange={e => setPos(e.target.value)}>
            {POSITIONS.map(p => <option key={p}>{p}</option>)}
          </select>
          <button style={{...S.btnPrimary, opacity: saving ? 0.5 : 1}} onClick={add} disabled={saving}>
            {saving ? "..." : "추가"}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>PLAYERS</span>
          <span style={S.cardSub}>{players.length}명</span>
        </div>
        {players.length === 0 && <Empty text="선수가 없습니다" />}
        {players.map(p => {
          const tier = getTier(p);
          return (
            <div key={p.id} style={S.playerRow}>
              {editing?.id === p.id ? (
                <div style={S.editRow}>
                  <input style={{...S.input, flex: 1}} value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
                  <select style={S.select} value={editing.position} onChange={e => setEditing({...editing, position: e.target.value})}>
                    {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
                  </select>
                  <button style={S.btnPrimary} onClick={saveEdit}>저장</button>
                  <button style={S.btnGhost} onClick={() => setEditing(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div style={S.playerLeft}>
                    <div style={S.playerTop}>
                      <span style={S.playerName}>{p.name}</span>
                      <PosTag pos={p.position} />
                      {tier && <span style={{...S.tierTag, color: tier.color, borderColor: tier.color + "40", background: tier.color + "10"}}>{tier.icon} {tier.name}</span>}
                    </div>
                    <div style={S.playerStats}>
                      <span style={S.statPill}>{p.wins}W {p.losses}L</span>
                      <span style={{...S.statPill, color: (p.win_rate||0) >= 60 ? "#059669" : (p.win_rate||0) >= 40 ? "#d97706" : "#dc2626", background: (p.win_rate||0) >= 60 ? "#d1fae5" : (p.win_rate||0) >= 40 ? "#fef3c7" : "#fee2e2"}}>{p.win_rate||0}%</span>
                      {p.mvp > 0 && <span style={{...S.statPill, color: "#d97706", background: "#fef3c7"}}>🏆 MVP ×{p.mvp}</span>}
                    </div>
                  </div>
                  <div style={S.playerActions}>
                    <button style={S.iconBtn} onClick={() => setEditing({id: p.id, name: p.name, position: p.position})}>✏️</button>
                    <button style={S.iconBtn} onClick={() => del(p.id)}>🗑</button>
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
  const [winner, setWinner] = useState("A");
  const [mvp, setMvp] = useState("");
  const [playerScores, setPlayerScores] = useState<Record<string,string>>({});
  const [showScores, setShowScores] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const inTeam = [...teamA, ...teamB];
  const free = players.filter(p => !inTeam.includes(p.id));
  const allTeamPlayers = inTeam.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];

  function toggleTeam(team: "A"|"B", id: string) {
    if (team === "A") setTeamA(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    else setTeamB(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submit() {
    if (!scoreA || !scoreB) return setErr("스코어를 입력하세요");
    if (teamA.length < 1 || teamB.length < 1) return setErr("각 팀 최소 1명");
    setErr(""); setSaving(true);
    try {
      const scores: Record<string,number> = {};
      Object.entries(playerScores).forEach(([k,v]) => { if(v) scores[k] = Number(v); });
      await sb.post("games", { id: uid(), score_a: Number(scoreA), score_b: Number(scoreB), team_a: teamA, team_b: teamB, winner, mvp: mvp||null, player_scores: scores });
      const winTeam = winner === "A" ? teamA : teamB;
      const loseTeam = winner === "A" ? teamB : teamA;
      await Promise.all(players.map(async p => {
        const isWin = winTeam.includes(p.id);
        const isLose = loseTeam.includes(p.id);
        if (!isWin && !isLose) return;
        const nw = p.wins + (isWin ? 1 : 0);
        const nl = p.losses + (isLose ? 1 : 0);
        const nm = p.mvp + (mvp === p.id ? 1 : 0);
        const nr = nw+nl > 0 ? Math.round((nw/(nw+nl))*100) : 0;
        await sb.patch("players", { wins:nw, losses:nl, mvp:nm, win_rate:nr }, `?id=eq.${p.id}`);
      }));
      setDone(true);
      setTimeout(() => { setDone(false); setScoreA(""); setScoreB(""); setTeamA([]); setTeamB([]); setWinner("A"); setMvp(""); setPlayerScores({}); onReload(); }, 1500);
    } catch(e:any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (done) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:12}}>
      <span style={{fontSize:48}}>✅</span>
      <span style={{fontSize:18,fontWeight:700,color:"#111"}}>저장 완료!</span>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>SCORE</span></div>
        <div style={S.scoreRow}>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>TEAM A</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreA} onChange={e => setScoreA(e.target.value)} />
          </div>
          <span style={S.scoreVs}>vs</span>
          <div style={S.scoreSide}>
            <span style={S.scoreLabel}>TEAM B</span>
            <input style={S.scoreInput} type="number" min="0" placeholder="0" value={scoreB} onChange={e => setScoreB(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>TEAMS</span></div>
        <div style={S.teamGrid}>
          {(["A","B"] as const).map(t => {
            const myTeam = t === "A" ? teamA : teamB;
            const accent = t === "A" ? "#2563eb" : "#dc2626";
            return (
              <div key={t} style={S.teamCol}>
                <div style={{...S.teamHead, borderColor: accent, color: accent}}>TEAM {t} · {myTeam.length}명</div>
                {myTeam.map(id => {
                  const p = players.find(x => x.id === id);
                  return p ? (
                    <div key={id} style={S.teamMember}>
                      <PosTag pos={p.position} />
                      <span style={{flex:1, fontSize:13, fontWeight:500}}>{p.name}</span>
                      <button style={S.removeBtn} onClick={() => toggleTeam(t, id)}>✕</button>
                    </div>
                  ) : null;
                })}
                <div style={S.freeList}>
                  {free.map(p => (
                    <button key={p.id} style={S.freeBtn} onClick={() => toggleTeam(t, p.id)}>
                      <PosTag pos={p.position} />
                      <span style={{fontSize:12, flex:1, textAlign:"left"}}>{p.name}</span>
                      <span style={{color: accent, fontWeight:700}}>+</span>
                    </button>
                  ))}
                  {free.length === 0 && <p style={{fontSize:11,color:"#9ca3af",padding:"6px 0"}}>모든 선수 배정됨</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>RESULT</span></div>
        <div style={{marginBottom:14}}>
          <div style={S.fieldLabel}>승리팀</div>
          <div style={S.winRow}>
            {(["A","B"] as const).map(t => (
              <button key={t} onClick={() => setWinner(t)} style={{
                ...S.winBtn,
                background: winner === t ? "#111" : "transparent",
                color: winner === t ? "#fff" : "#6b7280",
                borderColor: winner === t ? "#111" : "#e5e7eb",
              }}>TEAM {t} {winner === t ? "🏆" : ""}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={S.fieldLabel}>MVP (선택)</div>
          <select style={{...S.select, width:"100%"}} value={mvp} onChange={e => setMvp(e.target.value)}>
            <option value="">없음</option>
            {allTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
          </select>
        </div>
        <div>
          <button style={{...S.btnGhost, width:"100%", marginBottom:8}} onClick={() => setShowScores(!showScores)}>
            {showScores ? "▲" : "▼"} 개인 득점 입력 (선택)
          </button>
          {showScores && (
            <div style={S.scoresBox}>
              {allTeamPlayers.length === 0 && <p style={{color:"#9ca3af",fontSize:12,textAlign:"center"}}>팀원을 먼저 추가하세요</p>}
              {allTeamPlayers.map(p => (
                <div key={p.id} style={S.scoreItemRow}>
                  <PosTag pos={p.position} />
                  <span style={{flex:1,fontSize:13,fontWeight:500,color: teamA.includes(p.id)?"#2563eb":"#dc2626"}}>{p.name}</span>
                  <input style={{...S.input,width:56,textAlign:"center",padding:"5px"}} type="number" min="0" placeholder="0"
                    value={playerScores[p.id]||""} onChange={e => setPlayerScores(prev => ({...prev,[p.id]:e.target.value}))} />
                  <span style={{fontSize:12,color:"#6b7280"}}>pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {err && <p style={{color:"#dc2626",fontSize:12,marginTop:8}}>{err}</p>}
        <button style={{...S.btnPrimary, width:"100%", padding:"13px 0", marginTop:12, fontSize:15, opacity: saving ? 0.6 : 1}} onClick={submit} disabled={saving}>
          {saving ? "저장 중..." : "경기 저장"}
        </button>
      </div>
    </div>
  );
}

// ── LOG ───────────────────────────────────────────────────────────────────────
function Log({ games, players, onReload }: { games: Game[]; players: Player[]; onReload: () => void }) {
  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    await sb.del("games", `?id=eq.${id}`); onReload();
  }
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>ALL GAMES</span>
          <span style={S.cardSub}>{games.length}경기</span>
        </div>
        {games.length === 0 && <Empty text="경기 기록이 없습니다" />}
        {games.map(g => (
          <div key={g.id} style={{...S.gameWrap, position:"relative"}}>
            <button style={S.delBtn} onClick={() => del(g.id)}>🗑</button>
            <GameCard game={g} players={players} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GAME CARD ─────────────────────────────────────────────────────────────────
function GameCard({ game, players }: { game: Game; players: Player[] }) {
  const pname = (id: string) => players.find(p => p.id === id)?.name ?? "?";
  const date = new Date(game.created_at).toLocaleDateString("ko-KR",{month:"short",day:"numeric"});
  const scores = game.player_scores || {};
  const hasScores = Object.keys(scores).length > 0;
  const allIds = [...(game.team_a||[]), ...(game.team_b||[])];

  return (
    <div style={S.gcWrap}>
      <div style={S.gcMeta}>
        <span style={S.gcDate}>{date}</span>
        {game.mvp && <span style={S.gcMvp}>🏆 MVP {pname(game.mvp)}</span>}
      </div>
      <div style={S.gcScore}>
        <div style={{textAlign:"center", flex:1}}>
          <div style={{...S.gcTeamLabel, color: game.winner==="A"?"#111":"#9ca3af"}}>TEAM A {game.winner==="A"?"🏆":""}</div>
          <div style={{...S.gcBigScore, color: game.winner==="A"?"#111":"#d1d5db"}}>{game.score_a}</div>
          <div style={S.gcNames}>{(game.team_a||[]).map(pname).join(" · ")}</div>
        </div>
        <div style={S.gcVs}>:</div>
        <div style={{textAlign:"center", flex:1}}>
          <div style={{...S.gcTeamLabel, color: game.winner==="B"?"#111":"#9ca3af"}}>TEAM B {game.winner==="B"?"🏆":""}</div>
          <div style={{...S.gcBigScore, color: game.winner==="B"?"#111":"#d1d5db"}}>{game.score_b}</div>
          <div style={S.gcNames}>{(game.team_b||[]).map(pname).join(" · ")}</div>
        </div>
      </div>
      {hasScores && (
        <div style={S.gcPts}>
          {allIds.filter(id => scores[id]).sort((a,b) => (scores[b]||0)-(scores[a]||0)).map(id => (
            <span key={id} style={S.gcPtChip}>{pname(id)} <b>{scores[id]}pts</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function PosTag({ pos }: { pos: string }) {
  const c: Record<string,string> = {PG:"#2563eb",SG:"#7c3aed",SF:"#059669",PF:"#d97706",C:"#dc2626"};
  return <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:3,background:(c[pos]||"#6b7280")+"15",color:c[pos]||"#6b7280",letterSpacing:0.5}}>{pos}</span>;
}
function Empty({ text }: { text: string }) {
  return <div style={{textAlign:"center",padding:"28px 0",color:"#9ca3af",fontSize:13}}>— {text} —</div>;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:        { minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter', sans-serif", color:"#111" },
  loadWrap:    { display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f8fafc",gap:12 },
  loadDot:     { width:12,height:12,borderRadius:"50%",background:"#111",animation:"spin 1s linear infinite" },
  loadText:    { fontSize:12,fontWeight:600,letterSpacing:2,color:"#6b7280" },

  header:      { background:"#fff", borderBottom:"1px solid #f1f5f9", padding:"0 16px", position:"sticky", top:0, zIndex:10 },
  headerInner: { display:"flex", alignItems:"center", justifyContent:"space-between", height:52 },
  logo:        { display:"flex", alignItems:"center", gap:8 },
  logoIcon:    { fontSize:22 },
  logoText:    { fontSize:18, fontWeight:900, letterSpacing:2, color:"#111" },
  headerRight: {},
  headerSub:   { fontSize:11, color:"#9ca3af", fontWeight:500, letterSpacing:0.5 },

  errorBar:    { background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"8px 16px", fontSize:12, color:"#dc2626", display:"flex", justifyContent:"space-between" },
  errX:        { background:"none", border:"none", color:"#dc2626", cursor:"pointer" },

  nav:         { background:"#fff", borderBottom:"1px solid #f1f5f9", padding:"0 16px" },
  navInner:    { display:"flex", gap:0 },
  navBtn:      { padding:"12px 14px", background:"transparent", border:"none", borderBottom:"2px solid transparent", color:"#6b7280", fontSize:13, fontWeight:600, cursor:"pointer", letterSpacing:0.3, transition:"all .15s" },
  navOn:       { color:"#111", borderBottomColor:"#111" },

  main:        { paddingBottom:60 },
  page:        { padding:"16px 14px", display:"flex", flexDirection:"column", gap:12, maxWidth:600, margin:"0 auto" },

  card:        { background:"#fff", borderRadius:12, border:"1px solid #f1f5f9", padding:"16px", animation:"fadeUp .25s both" },
  cardHeader:  { display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 },
  cardTitle:   { fontSize:11, fontWeight:800, letterSpacing:2, color:"#111" },
  cardSub:     { fontSize:11, color:"#9ca3af" },

  summaryRow:  { background:"#fff", borderRadius:12, border:"1px solid #f1f5f9", padding:"16px", display:"flex", alignItems:"center" },
  summaryCard: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 },
  summaryNum:  { fontSize:24, fontWeight:900, color:"#111" },
  summaryLabel:{ fontSize:9, fontWeight:700, letterSpacing:1.5, color:"#9ca3af" },
  summaryDivider: { width:1, height:32, background:"#f1f5f9", flexShrink:0 },

  rankRow:     { display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid #f8fafc", animation:"fadeUp .2s both" },
  rankIdx:     { fontSize:13, fontWeight:800, width:18, flexShrink:0, textAlign:"center" },
  rankInfo:    { flex:1, minWidth:0 },
  rankTop:     { display:"flex", alignItems:"center", gap:5, marginBottom:5, flexWrap:"wrap" },
  rankName:    { fontSize:14, fontWeight:700, color:"#111" },
  rankBar:     { height:3, background:"#f1f5f9", borderRadius:2, overflow:"hidden" },
  rankFill:    { height:"100%", borderRadius:2, transition:"width .5s" },
  rankStat:    { display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0 },
  rankRate:    { fontSize:15, fontWeight:800, color:"#111" },
  rankRecord:  { fontSize:10, color:"#9ca3af", fontWeight:500 },

  tierTag:     { fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:3, border:"1px solid", letterSpacing:0.5 },
  tierRow:     { display:"flex", gap:6, flexWrap:"wrap" },
  tierItem:    { flex:1, minWidth:54, display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"8px 4px", borderRadius:8, border:"1px solid" },
  tierName:    { fontSize:8, fontWeight:800, letterSpacing:1 },
  tierMin:     { fontSize:9, color:"#9ca3af" },

  addRow:      { display:"flex", gap:8 },
  input:       { flex:1, background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 12px", color:"#111", fontSize:13, fontWeight:500, transition:"border-color .15s" },
  select:      { background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 10px", color:"#111", fontSize:13, fontWeight:500 },
  btnPrimary:  { background:"#111", border:"none", borderRadius:8, padding:"9px 16px", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" as const },
  btnGhost:    { background:"transparent", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 14px", color:"#6b7280", cursor:"pointer", fontSize:12, fontWeight:500 },
  iconBtn:     { background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"4px", color:"#9ca3af" },

  playerRow:   { display:"flex", alignItems:"center", gap:8, padding:"10px 0", borderBottom:"1px solid #f8fafc", flexWrap:"wrap" as const },
  playerLeft:  { flex:1 },
  playerTop:   { display:"flex", alignItems:"center", gap:5, marginBottom:4, flexWrap:"wrap" as const },
  playerName:  { fontSize:14, fontWeight:700, color:"#111" },
  playerStats: { display:"flex", gap:4, flexWrap:"wrap" as const },
  playerActions:{ display:"flex", gap:2 },
  statPill:    { fontSize:11, fontWeight:600, padding:"2px 7px", borderRadius:20, background:"#f1f5f9", color:"#6b7280" },
  editRow:     { display:"flex", gap:6, alignItems:"center", flex:1, flexWrap:"wrap" as const },

  scoreRow:    { display:"flex", alignItems:"center", gap:16, justifyContent:"center" },
  scoreSide:   { display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
  scoreLabel:  { fontSize:10, fontWeight:700, letterSpacing:1.5, color:"#9ca3af" },
  scoreInput:  { width:88, background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px 0", color:"#111", fontSize:36, fontWeight:900, textAlign:"center" },
  scoreVs:     { fontSize:16, color:"#d1d5db", fontWeight:700 },

  teamGrid:    { display:"flex", gap:10 },
  teamCol:     { flex:1, minWidth:0 },
  teamHead:    { fontSize:10, fontWeight:800, letterSpacing:1, padding:"6px 0", borderBottom:"2px solid", marginBottom:6 },
  teamMember:  { display:"flex", alignItems:"center", gap:6, padding:"5px 0", borderBottom:"1px solid #f8fafc" },
  freeList:    { paddingTop:4 },
  freeBtn:     { display:"flex", alignItems:"center", gap:5, padding:"5px 0", width:"100%", background:"transparent", border:"none", color:"#9ca3af", cursor:"pointer", borderBottom:"1px solid #f8fafc" },
  removeBtn:   { background:"none", border:"none", color:"#d1d5db", cursor:"pointer", fontSize:12, padding:2 },

  fieldLabel:  { fontSize:10, fontWeight:700, letterSpacing:1, color:"#9ca3af", marginBottom:6 },
  winRow:      { display:"flex", gap:8 },
  winBtn:      { flex:1, padding:"10px 0", borderRadius:8, border:"1px solid", cursor:"pointer", fontWeight:700, fontSize:13, transition:"all .15s" },
  scoresBox:   { background:"#f8fafc", borderRadius:8, padding:10 },
  scoreItemRow:{ display:"flex", alignItems:"center", gap:8, marginBottom:6 },

  gameWrap:    { padding:"12px 0", borderBottom:"1px solid #f8fafc" },
  delBtn:      { position:"absolute", top:12, right:0, background:"none", border:"none", color:"#e5e7eb", cursor:"pointer", fontSize:14 },
  gcWrap:      {},
  gcMeta:      { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  gcDate:      { fontSize:11, color:"#9ca3af", fontWeight:500 },
  gcMvp:       { fontSize:11, color:"#d97706", fontWeight:600, background:"#fef3c7", padding:"2px 8px", borderRadius:4 },
  gcScore:     { display:"flex", alignItems:"center", gap:8, justifyContent:"space-around" },
  gcTeamLabel: { fontSize:10, fontWeight:700, letterSpacing:1, marginBottom:4 },
  gcBigScore:  { fontSize:38, fontWeight:900, lineHeight:1 },
  gcNames:     { fontSize:10, color:"#9ca3af", marginTop:4 },
  gcVs:        { fontSize:18, color:"#e5e7eb", fontWeight:900 },
  gcPts:       { display:"flex", flexWrap:"wrap", gap:4, marginTop:10, paddingTop:10, borderTop:"1px solid #f8fafc" },
  gcPtChip:    { fontSize:11, background:"#f8fafc", borderRadius:4, padding:"2px 8px", color:"#6b7280" },
};
