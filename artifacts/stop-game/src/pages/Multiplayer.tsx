import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input } from "@/components/ui";
import { useCreateRoom, useJoinRoom } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { OnlineFriends } from "@/components/OnlineFriends";
import { Users, Plus, LogIn } from "lucide-react";

export default function Multiplayer() {
  const [, setLocation] = useLocation();
  const { player } = usePlayer();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const createMutation = useCreateRoom();
  const joinMutation = useJoinRoom();

  const handleCreate = async () => {
    if (!player) return;
    try {
      const room = await createMutation.mutateAsync({
        data: {
          hostId: player.id,
          hostName: player.name,
          avatarColor: player.avatarColor,
          maxRounds: 3,
          language: "es"
        }
      });
      setLocation(`/room/${room.roomCode}`);
    } catch (e) {
      setError("Error al crear la sala. Inténtalo de nuevo.");
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !roomCode.trim()) return;
    
    try {
      const room = await joinMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: {
          playerId: player.id,
          playerName: player.name,
          avatarColor: player.avatarColor
        }
      });
      setLocation(`/room/${room.roomCode}`);
    } catch (e) {
      setError("No se encontró la sala o está llena.");
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full space-y-5 py-4">
        
        <div className="text-center">
          <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/10">
            <Users className="w-10 h-10 text-secondary" />
          </div>
          <h1 className="text-4xl font-display font-bold">Multijugador</h1>
          <p className="text-white/80 mt-2">Juega con tus amigos en tiempo real</p>
        </div>

        {error && (
          <div className="bg-red-500/20 text-white border border-red-500 p-4 rounded-xl w-full text-center font-bold">
            {error}
          </div>
        )}

        {/* Online friends panel */}
        {player && <OnlineFriends player={player} />}

        <Card className="w-full p-6 space-y-6">
          <div>
            <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Plus className="text-secondary" /> Crear Sala
            </h3>
            <Button 
              size="lg" 
              className="w-full" 
              onClick={handleCreate}
              isLoading={createMutation.isPending}
            >
              Crear Nueva Partida
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-white/50 font-bold">O únete a una existente</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <LogIn className="text-secondary" /> Unirse a Sala
            </h3>
            <div>
              <Input 
                placeholder="Código de 6 letras (Ej: ABCD12)" 
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center tracking-[0.2em] font-display font-bold text-2xl uppercase"
              />
            </div>
            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full" 
              type="submit"
              disabled={roomCode.length < 4}
              isLoading={joinMutation.isPending}
            >
              Entrar a la Sala
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
