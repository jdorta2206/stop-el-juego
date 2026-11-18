import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, BookOpen, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-8 w-8 text-red-500 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-600">Error 404</p>
              <h1 className="text-2xl font-bold text-gray-900">No encontramos esta página</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-gray-600">
            Es posible que la dirección haya cambiado o que la página ya no exista.
            Puedes volver al juego o descubrir nuestros artículos en el blog.
          </p>

          <nav aria-label="Enlaces de navegación" className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              <Home className="h-4 w-4" aria-hidden="true" />
              Volver al juego
            </Link>
            <Link href="/blog" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Visitar el blog
            </Link>
          </nav>
        </CardContent>
      </Card>
    </main>
  );
}
