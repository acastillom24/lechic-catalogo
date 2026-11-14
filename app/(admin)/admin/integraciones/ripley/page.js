import { getCuentasRipley } from "../../../../../lib/ripley-cuentas";
import CuentasRipley from "../../../../../components/admin/CuentasRipley";
import ExploradorRipley from "../../../../../components/admin/ExploradorRipley";

export const metadata = { title: "Ripley · Panel Le Chic" };
export const dynamic = "force-dynamic";

export default async function RipleyPage() {
  const cuentas = await getCuentasRipley();
  return (
    <div className="form-grid">
      <CuentasRipley cuentas={cuentas} />
      <ExploradorRipley cuentas={cuentas.filter((c) => c.activo && c.tiene_key)} />
    </div>
  );
}
