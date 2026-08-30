import LoginForm from "../../../../components/admin/LoginForm";

export const metadata = { title: "Ingresar · Panel Le Chic" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const redirectTo = typeof params?.redirect === "string" ? params.redirect : "/admin";

  return <LoginForm redirectTo={redirectTo} />;
}
