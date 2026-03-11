import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Medal, Star } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { motion } from "framer-motion";

export default function Ranking() {
  const { data, isLoading } = useGetLeaderboard({ limit: 50 });
  const { player } = usePlayer();
  const [filter, setFilter] = useState<"global" | "amigos">("global");

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full py-8 space-y-6">
        
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-display font-black text-white flex items-center justify-center gap-4">
            <Trophy className="w-10 h-10 text-secondary" /> 
            Clasificación
            <Trophy className="w-10 h-10 text-secondary" />
          </h1>
          <p className="text-white/80 mt-2 font-bold">Los mejores jugadores del mundo</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-black/30 p-1 rounded-full flex gap-1">
            <button 
              className={`px-6 py-2 rounded-full font-bold transition-all ${filter === 'global' ? 'bg-secondary text-black shadow-md' : 'text-white hover:bg-white/10'}`}
              onClick={() => setFilter("global")}
            >
              Global
            </button>
            <button 
              className={`px-6 py-2 rounded-full font-bold transition-all ${filter === 'amigos' ? 'bg-secondary text-black shadow-md' : 'text-white hover:bg-white/10'}`}
              onClick={() => setFilter("amigos")}
            >
              Amigos
            </button>
          </div>
        </div>

        <Card className="p-2 bg-black/20 border-white/10 shadow-2xl">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse">Cargando ranking...</div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Header row */}
              <div className="grid grid-cols-[40px_1fr_80px_80px] md:grid-cols-[60px_1fr_100px_100px] gap-2 px-4 py-2 text-xs font-bold text-white/50 uppercase tracking-wider">
                <div className="text-center">#</div>
                <div>Jugador</div>
                <div className="text-center">Partidas</div>
                <div className="text-right">Puntos</div>
              </div>

              {/* Data rows */}
              {data?.players?.map((p, index) => {
                const isMe = p.playerId === player?.id;
                const position = index + 1;
                
                let PositionIcon = null;
                if (position === 1) PositionIcon = <Crown color="#fbbf24" />;
                else if (position === 2) PositionIcon = <Crown color="#9ca3af" />;
                else if (position === 3) PositionIcon = <Crown color="#b45309" />;

                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={p.playerId} 
                    className={`grid grid-cols-[40px_1fr_80px_80px] md:grid-cols-[60px_1fr_100px_100px] gap-2 p-3 items-center rounded-xl transition-all ${
                      isMe ? 'bg-secondary text-black font-black scale-[1.02] shadow-lg shadow-secondary/20 my-2' : 'bg-card hover:bg-card/80 border border-white/5 text-white font-bold'
                    }`}
                  >
                    <div className="text-center text-lg flex justify-center">
                      {PositionIcon ? PositionIcon : <span className={isMe ? 'text-black/50' : 'text-white/30'}>{position}</span>}
                    </div>
                    
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm shadow-inner" style={{ backgroundColor: p.avatarColor || '#555' }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{p.playerName} {isMe && "(Tú)"}</span>
                    </div>

                    <div className={`text-center ${isMe ? 'text-black/70' : 'text-white/70'}`}>
                      {p.gamesPlayed}
                    </div>

                    <div className={`text-right text-lg ${isMe ? 'text-black' : 'text-secondary'}`}>
                      {p.totalScore}
                    </div>
                  </motion.div>
                );
              })}
              
              {(!data?.players || data.players.length === 0) && (
                <div className="p-12 text-center text-white/50 font-bold">
                  Aún no hay puntuaciones registradas.<br/>¡Sé el primero en jugar!
                </div>
              )}
            </div>
          )}
        </Card>

      </div>
    </Layout>
  );
}

function Crown({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
      <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 16H19V19C19 19.5523 18.5523 20 18 20H6C5.44772 20 5 19.5523 5 19V16Z" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
