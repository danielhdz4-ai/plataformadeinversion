import { redirect } from "next/navigation";

/** Entrada por defecto de la app autenticada → Inicio (dashboard). */
export default function AppHomePage() {
  redirect("/app/inicio");
}
