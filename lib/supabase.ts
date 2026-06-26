const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

const DEMO_DATA: Record<string, any[]> = {
  players: [
    { id: "1", name: "김민준", position: "PG", wins: 12, losses: 4, mvp: 5, win_rate: 75, avg_points: 18.3, signature: "드라이브 앤 킥", best_score: 32, duel_wins: 6, duel_losses: 2 },
    { id: "2", name: "이준혁", position: "SG", wins: 10, losses: 6, mvp: 3, win_rate: 63, avg_points: 22.1, signature: "풀업 점퍼", best_score: 38, duel_wins: 5, duel_losses: 3 },
    { id: "3", name: "박지훈", position: "SF", wins: 8, losses: 8, mvp: 2, win_rate: 50, avg_points: 14.7, signature: "", best_score: 24, duel_wins: 3, duel_losses: 5 },
    { id: "4", name: "최성우", position: "PF", wins: 6, losses: 10, mvp: 1, win_rate: 38, avg_points: 11.2, signature: "포스트업", best_score: 20, duel_wins: 2, duel_losses: 4 },
    { id: "5", name: "정태양", position: "C",  wins: 14, losses: 2, mvp: 7, win_rate: 88, avg_points: 16.0, signature: "훅샷", best_score: 28, duel_wins: 8, duel_losses: 1 },
  ],
  games: [
    { id: "g1", created_at: "2025-06-20T10:00:00Z", score_a: 21, score_b: 15, team_a: ["1","3"], team_b: ["2","4"], winner: "A", mvp: "1", player_scores: {"1":14,"3":7,"2":10,"4":5} },
    { id: "g2", created_at: "2025-06-18T14:00:00Z", score_a: 16, score_b: 21, team_a: ["2","5"], team_b: ["1","4"], winner: "B", mvp: "5", player_scores: {"2":9,"5":7,"1":15,"4":6} },
    { id: "g3", created_at: "2025-06-15T11:00:00Z", score_a: 21, score_b: 18, team_a: ["5","3"], team_b: ["2","1"], winner: "A", mvp: "5", player_scores: {"5":12,"3":9,"2":11,"1":7} },
    { id: "g4", created_at: "2025-06-12T09:00:00Z", score_a: 21, score_b: 10, team_a: ["1","2"], team_b: ["3","4"], winner: "A", mvp: "2", player_scores: {"1":10,"2":11,"3":6,"4":4} },
  ],
  duels: [
    { id: "d1", created_at: "2025-06-19T12:00:00Z", player_a: "1", player_b: "2", score_a: 11, score_b: 7, winner: "1" },
    { id: "d2", created_at: "2025-06-17T15:00:00Z", player_a: "5", player_b: "3", score_a: 11, score_b: 4, winner: "5" },
    { id: "d3", created_at: "2025-06-14T10:00:00Z", player_a: "2", player_b: "5", score_a: 9, score_b: 11, winner: "5" },
  ],
};

const IS_DEMO = SUPABASE_URL === "http://localhost:1";

export const sb = {
  async query(table: string, method = "GET", body: object | null = null, filter = "") {
    if (IS_DEMO) {
      if (method === "GET") return DEMO_DATA[table] ?? [];
      return body;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) { const e = await res.text(); throw new Error(e); }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  get:   (t: string, f = "")                      => sb.query(t, "GET",    null, f),
  post:  (t: string, b: object)                   => sb.query(t, "POST",   b),
  patch: (t: string, b: object, f: string)        => sb.query(t, "PATCH",  b, f),
  del:   (t: string, f: string)                   => sb.query(t, "DELETE", null, f),
};
