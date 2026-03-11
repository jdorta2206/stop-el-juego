import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card } from "@/components/ui";
import { Play, Users, Trophy, Share2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'STOP - El Juego',
          text: '¡Juega a STOP conmigo! Demuestra quién es el más rápido escribiendo palabras.',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share error:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full space-y-8 py-8">
        
        <motion.div 
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-7xl md:text-9xl font-display font-black text-white text-shadow-md tracking-tighter">
            STOP
          </h1>
          <p className="text-xl md:text-2xl text-secondary font-bold text-shadow-sm mt-2">
            El clásico juego de palabras
          </p>
        </motion.div>

        <Card className="w-full p-6 space-y-4 bg-black/20 border-white/10">
          <Link href="/solo">
            <Button size="xl" className="w-full flex items-center justify-center gap-3">
              <Play className="fill-current w-6 h-6" /> 
              JUGAR VS IA
            </Button>
          </Link>
          
          <div className="grid grid-cols-2 gap-4">
            <Link href="/multiplayer">
              <Button variant="secondary" size="lg" className="w-full flex flex-col items-center py-6 h-auto gap-2">
                <Users className="w-8 h-8" />
                <span className="text-sm">Multijugador</span>
              </Button>
            </Link>
            
            <Link href="/ranking">
              <Button variant="secondary" size="lg" className="w-full flex flex-col items-center py-6 h-auto gap-2">
                <Trophy className="w-8 h-8" />
                <span className="text-sm">Ranking</span>
              </Button>
            </Link>
          </div>
        </Card>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          className="flex items-center gap-2 text-white/80 hover:text-white font-semibold transition-colors"
        >
          <Share2 className="w-5 h-5" /> Invitar Amigos
        </motion.button>
      </div>
    </Layout>
  );
}
