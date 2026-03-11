import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input } from "@/components/ui";
import { useGetRoom } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Share2, Copy, Play, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { player } = usePlayer();
  
  // Polling for real-time updates (simulated websocket behavior)
  const { data: room, error, isLoading } = useGetRoom(id || "", {
    query: {
      refetchInterval: 2000, // Poll every 2s
      enabled: !!id
    }
  });

  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-display font-bold mb-4">Sala no encontrada</h2>
          <Button onClick={() => setLocation("/multiplayer")}>Volver</Button>
        </div>
      </Layout>
    );
  }

  const isHost = room?.hostId === player?.id;

  const handleShare = async () => {
    const url = `${window.location.origin}/multiplayer?code=${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a mi partida de STOP',
          text: `Código de sala: ${id}`,
          url: url,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(`¡Únete a mi sala de STOP! Código: ${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If game is playing, redirect or show game UI
  // For this artifact, we'll build a simplified lobby view that transitions
  // A full multiplayer implementation would duplicate SoloGame logic but sync via API
  
  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-8">
        
        <button onClick={() => setLocation("/multiplayer")} className="flex items-center gap-2 text-white/70 hover:text-white mb-6 w-fit transition-colors">
          <ArrowLeft className="w-4 h-4" /> Salir de la sala
        </button>

        <div className="text-center mb-8">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-2">Código de la Sala</h2>
          <div className="bg-black/30 inline-block px-8 py-4 rounded-2xl border-2 border-white/20 backdrop-blur-md">
            <h1 className="text-6xl font-display font-black tracking-widest text-secondary text-shadow-glow">
              {id}
            </h1>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="font-display font-bold text-xl mb-4 flex items-center justify-between">
              Jugadores ({room?.players?.length || 0}/8)
            </h3>
            
            <div className="space-y-3">
              {room?.players?.map(p => (
                <div key={p.playerId} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner" style={{ backgroundColor: p.avatarColor || '#333' }}>
                    {p.playerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold flex items-center gap-2">
                      {p.playerName}
                      {p.playerId === room.hostId && <span className="text-xs bg-secondary text-black px-2 py-0.5 rounded-full">HOST</span>}
                      {p.playerId === player?.id && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">TÚ</span>}
                    </p>
                  </div>
                  {p.isReady ? (
                    <span className="text-green-400 text-xs font-bold uppercase">Listo</span>
                  ) : (
                    <span className="text-white/40 text-xs font-bold uppercase">Esperando</span>
                  )}
                </div>
              ))}

              {isLoading && !room && (
                <div className="animate-pulse space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-white/10 rounded-xl" />)}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-4 flex flex-col">
            <Card className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-4 bg-primary/40">
              <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center mb-2">
                <Share2 className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="font-display font-bold text-xl">Invita a tus amigos</h3>
              <p className="text-sm text-white/70">Comparte el código o el enlace directo por WhatsApp, Instagram o donde quieras.</p>
              <Button variant="secondary" className="w-full mt-auto" onClick={handleShare}>
                {copied ? "¡Copiado!" : "Compartir Enlace"}
              </Button>
            </Card>

            {isHost ? (
              <Button size="xl" className="w-full shadow-xl shadow-primary/50 border-2 border-white/20">
                <Play className="w-6 h-6 mr-2 fill-current" /> INICIAR PARTIDA
              </Button>
            ) : (
              <div className="bg-black/20 p-4 rounded-xl text-center border border-white/10">
                <p className="font-bold animate-pulse text-secondary">Esperando al anfitrión...</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
